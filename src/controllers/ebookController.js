const mongoose = require('mongoose');
const { body, query, param } = require('express-validator');
const Ebook = require('../models/Ebook');
const Transaction = require('../models/Transaction');
const { AppError } = require('../utils/errorHandler');

/**
 * GET /api/ebooks
 * Browse all published ebooks with search, filter, sort, and pagination.
 */
async function getEbooks(req, res, next) {
  try {
    const {
      search,
      genre,
      minPrice,
      maxPrice,
      availability,
      sort = 'newest',
      page = 1,
      limit = 12,
    } = req.query;

    // Fetch user purchased book ids if logged in
    let purchasedEbookIds = [];
    let purchasedEbookObjectIds = [];
    if (req.user) {
      const transactions = await Transaction.find({
        buyer: req.user._id,
        status: 'completed',
      }).select('ebook');
      purchasedEbookIds = transactions.map((t) => t.ebook.toString());
      purchasedEbookObjectIds = transactions.map((t) => t.ebook);
    }

    const filter = {};
    if (!req.user || req.user.role !== 'admin') {
      filter.status = 'published';
    }

    // Search by title or writer name
    if (search) {
      const searchRegex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ title: searchRegex }];
    }

    // Filter by genre
    if (genre) {
      filter.genre = genre;
    }

    // Filter by price range
    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = parseFloat(minPrice);
      if (maxPrice) filter.price.$lte = parseFloat(maxPrice);
    }

    // Filter by availability (role-based)
    if (availability === 'in-stock') {
      if (req.user && req.user.role === 'admin') {
        filter.totalSold = 0;
      } else if (req.user) {
        filter._id = { $nin: purchasedEbookObjectIds };
      }
    } else if (availability === 'sold') {
      if (req.user && req.user.role === 'admin') {
        filter.totalSold = { $gt: 0 };
      } else if (req.user) {
        filter._id = { $in: purchasedEbookObjectIds };
      } else {
        filter._id = { $in: [] };
      }
    }

    // Sorting
    let sortOption = {};
    switch (sort) {
      case 'price-low':
        sortOption = { price: 1 };
        break;
      case 'price-high':
        sortOption = { price: -1 };
        break;
      case 'oldest':
        sortOption = { createdAt: 1 };
        break;
      case 'newest':
      default:
        sortOption = { createdAt: -1 };
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 12));
    const skip = (pageNum - 1) * limitNum;

    // If searching by writer name, we need a different approach
    let pipeline;
    if (search) {
      const searchRegex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      pipeline = [
        {
          $lookup: {
            from: 'users',
            localField: 'writer',
            foreignField: '_id',
            as: 'writerInfo',
          },
        },
        { $unwind: '$writerInfo' },
        {
          $match: {
            ...(!req.user || req.user.role !== 'admin' ? { status: 'published' } : {}),
            ...(genre ? { genre } : {}),
            ...(minPrice || maxPrice
              ? {
                  price: {
                    ...(minPrice ? { $gte: parseFloat(minPrice) } : {}),
                    ...(maxPrice ? { $lte: parseFloat(maxPrice) } : {}),
                  },
                }
              : {}),
            ...(availability === 'in-stock'
              ? (req.user && req.user.role === 'admin'
                ? { totalSold: 0 }
                : req.user
                  ? { _id: { $nin: purchasedEbookObjectIds } }
                  : {})
              : {}),
            ...(availability === 'sold'
              ? (req.user && req.user.role === 'admin'
                ? { totalSold: { $gt: 0 } }
                : req.user
                  ? { _id: { $in: purchasedEbookObjectIds } }
                  : { _id: { $in: [] } })
              : {}),
            $or: [
              { title: searchRegex },
              { 'writerInfo.name': searchRegex },
            ],
          },
        },
        {
          $facet: {
            data: [
              { $sort: sortOption },
              { $skip: skip },
              { $limit: limitNum },
              {
                $project: {
                  title: 1,
                  description: { $substrCP: ['$description', 0, 200] },
                  price: 1,
                  genre: 1,
                  coverImage: 1,
                  status: 1,
                  totalSold: 1,
                  createdAt: 1,
                  updatedAt: 1,
                  writer: {
                    _id: '$writerInfo._id',
                    name: '$writerInfo.name',
                    avatar: '$writerInfo.avatar',
                  },
                },
              },
            ],
            total: [{ $count: 'count' }],
          },
        },
      ];

      const results = await Ebook.aggregate(pipeline);
      let ebooks = results[0].data;
      const total = results[0].total[0]?.count || 0;

      if (req.user) {
        ebooks = ebooks.map((obj) => {
          obj.isPurchased = purchasedEbookIds.includes(obj._id.toString());
          return obj;
        });
      }

      return res.json({
        success: true,
        ebooks,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      });
    }

    const [ebooksDocs, total] = await Promise.all([
      Ebook.find(filter)
        .populate('writer', 'name avatar')
        .sort(sortOption)
        .skip(skip)
        .limit(limitNum)
        .select('-description'),
      Ebook.countDocuments(filter),
    ]);

    const ebooks = ebooksDocs.map((doc) => {
      const obj = doc.toObject();
      if (req.user) {
        obj.isPurchased = purchasedEbookIds.includes(obj._id.toString());
      }
      return obj;
    });

    res.json({
      success: true,
      ebooks,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/ebooks/featured
 * Get latest 8 ebooks for homepage.
 */
async function getFeaturedEbooks(req, res, next) {
  try {
    const ebooksDocs = await Ebook.find({ status: 'published' })
      .populate('writer', 'name avatar')
      .sort({ createdAt: -1 })
      .limit(8)
      .select('-description');

    let purchasedEbookIds = [];
    if (req.user) {
      const transactions = await Transaction.find({
        buyer: req.user._id,
        status: 'completed',
      }).select('ebook');
      purchasedEbookIds = transactions.map((t) => t.ebook.toString());
    }

    const ebooks = ebooksDocs.map((doc) => {
      const obj = doc.toObject();
      if (req.user) {
        obj.isPurchased = purchasedEbookIds.includes(obj._id.toString());
      }
      return obj;
    });

    // Cache for 60s to speed up first-load on the homepage
    res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=120');
    res.json({ success: true, ebooks });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/ebooks/:id
 * Get single ebook details.
 */
async function getEbook(req, res, next) {
  try {
    const ebook = await Ebook.findById(req.params.id).populate(
      'writer',
      'name avatar email'
    );

    if (!ebook) {
      throw new AppError('Ebook not found', 404);
    }

    // If ebook is unpublished, only writer or admin can view
    if (ebook.status === 'unpublished') {
      if (
        !req.user ||
        (req.user.role !== 'admin' &&
          req.user._id.toString() !== ebook.writer._id.toString())
      ) {
        throw new AppError('Ebook not found', 404);
      }
    }

    res.json({ success: true, ebook });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/ebooks/writer/:writerId
 * Get ebooks by specific writer.
 */
async function getEbooksByWriter(req, res, next) {
  try {
    const filter = { writer: req.params.writerId };

    // Only show published ebooks unless it's the writer or admin
    if (
      !req.user ||
      (req.user.role !== 'admin' &&
        req.user._id.toString() !== req.params.writerId)
    ) {
      filter.status = 'published';
    }

    const ebooksDocs = await Ebook.find(filter)
      .populate('writer', 'name avatar')
      .sort({ createdAt: -1 })
      .select('-description');

    let purchasedEbookIds = [];
    if (req.user) {
      const transactions = await Transaction.find({
        buyer: req.user._id,
        status: 'completed',
      }).select('ebook');
      purchasedEbookIds = transactions.map((t) => t.ebook.toString());
    }

    const ebooks = ebooksDocs.map((doc) => {
      const obj = doc.toObject();
      if (req.user) {
        obj.isPurchased = purchasedEbookIds.includes(obj._id.toString());
      }
      return obj;
    });

    res.json({ success: true, ebooks });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/ebooks
 * Create a new ebook (writer only).
 */
const createEbookValidation = [
  body('title')
    .trim()
    .notEmpty()
    .withMessage('Title is required')
    .isLength({ max: 200 })
    .withMessage('Title cannot exceed 200 characters'),
  body('description')
    .trim()
    .notEmpty()
    .withMessage('Description is required')
    .isLength({ max: 50000 })
    .withMessage('Description cannot exceed 50000 characters'),
  body('price')
    .isFloat({ min: 0 })
    .withMessage('Price must be a positive number'),
  body('genre')
    .isIn([
      'Fiction', 'Mystery', 'Romance', 'Sci-Fi', 'Fantasy', 'Horror',
      'Thriller', 'Non-Fiction', 'Biography', 'Self-Help', 'History', 'Poetry',
    ])
    .withMessage('Invalid genre'),
  body('coverImage')
    .trim()
    .notEmpty()
    .withMessage('Cover image is required')
    .isURL()
    .withMessage('Cover image must be a valid URL'),
];

async function createEbook(req, res, next) {
  try {
    const { title, description, price, genre, coverImage } = req.body;

    const ebook = await Ebook.create({
      title,
      description,
      price,
      genre,
      coverImage,
      writer: req.user._id,
    });

    await ebook.populate('writer', 'name avatar');

    res.status(201).json({
      success: true,
      message: 'Ebook created successfully',
      ebook,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PUT /api/ebooks/:id
 * Update an ebook (writer/owner only).
 */
async function updateEbook(req, res, next) {
  try {
    const ebook = await Ebook.findById(req.params.id);

    if (!ebook) {
      throw new AppError('Ebook not found', 404);
    }

    // Only owner or admin can update
    if (
      req.user.role !== 'admin' &&
      req.user._id.toString() !== ebook.writer.toString()
    ) {
      throw new AppError('You can only edit your own ebooks', 403);
    }

    const { title, description, price, genre, coverImage } = req.body;

    if (title) ebook.title = title;
    if (description) ebook.description = description;
    if (price !== undefined) ebook.price = price;
    if (genre) ebook.genre = genre;
    if (coverImage) ebook.coverImage = coverImage;

    await ebook.save();
    await ebook.populate('writer', 'name avatar');

    res.json({
      success: true,
      message: 'Ebook updated successfully',
      ebook,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /api/ebooks/:id/status
 * Publish or unpublish an ebook (writer/owner or admin).
 */
const statusValidation = [
  body('status')
    .isIn(['published', 'unpublished'])
    .withMessage('Status must be published or unpublished'),
];

async function updateEbookStatus(req, res, next) {
  try {
    const ebook = await Ebook.findById(req.params.id);

    if (!ebook) {
      throw new AppError('Ebook not found', 404);
    }

    // Only owner or admin can change status
    if (
      req.user.role !== 'admin' &&
      req.user._id.toString() !== ebook.writer.toString()
    ) {
      throw new AppError('You can only manage your own ebooks', 403);
    }

    ebook.status = req.body.status;
    await ebook.save();

    res.json({
      success: true,
      message: `Ebook ${req.body.status} successfully`,
      ebook,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /api/ebooks/:id
 * Delete an ebook (writer/owner or admin).
 */
async function deleteEbook(req, res, next) {
  try {
    const ebook = await Ebook.findById(req.params.id);

    if (!ebook) {
      throw new AppError('Ebook not found', 404);
    }

    // Only owner or admin can delete
    if (
      req.user.role !== 'admin' &&
      req.user._id.toString() !== ebook.writer.toString()
    ) {
      throw new AppError('You can only delete your own ebooks', 403);
    }

    await ebook.deleteOne();

    res.json({
      success: true,
      message: 'Ebook deleted successfully',
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/ebooks/:id/related
 * Get up to 4 ebooks in the same genre, excluding the current one.
 */
async function getRelatedEbooks(req, res, next) {
  try {
    const ebook = await Ebook.findById(req.params.id).select('genre');
    if (!ebook) throw new AppError('Ebook not found', 404);

    const related = await Ebook.find({
      _id: { $ne: ebook._id },
      genre: ebook.genre,
      status: 'published',
    })
      .populate('writer', 'name avatar')
      .sort({ totalSold: -1, createdAt: -1 })
      .limit(4)
      .select('-description');

    res.json({ success: true, ebooks: related });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getEbooks,
  getFeaturedEbooks,
  getEbook,
  getRelatedEbooks,
  getEbooksByWriter,
  createEbook,
  createEbookValidation,
  updateEbook,
  updateEbookStatus,
  statusValidation,
  deleteEbook,
};
