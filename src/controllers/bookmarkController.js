const Bookmark = require('../models/Bookmark');
const { AppError } = require('../utils/errorHandler');

/**
 * POST /api/bookmarks/:ebookId
 * Toggle bookmark on an ebook.
 */
async function toggleBookmark(req, res, next) {
  try {
    const { ebookId } = req.params;

    const existing = await Bookmark.findOne({
      user: req.user._id,
      ebook: ebookId,
    });

    if (existing) {
      await existing.deleteOne();
      return res.json({
        success: true,
        bookmarked: false,
        message: 'Bookmark removed',
      });
    }

    await Bookmark.create({
      user: req.user._id,
      ebook: ebookId,
    });

    res.status(201).json({
      success: true,
      bookmarked: true,
      message: 'Ebook bookmarked',
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/bookmarks
 * Get all bookmarks for the current user.
 */
async function getBookmarks(req, res, next) {
  try {
    const bookmarks = await Bookmark.find({ user: req.user._id })
      .populate({
        path: 'ebook',
        select: 'title coverImage price genre writer status',
        populate: { path: 'writer', select: 'name avatar' },
      })
      .sort({ createdAt: -1 });

    // Filter out bookmarks where the ebook was deleted
    const validBookmarks = bookmarks.filter((b) => b.ebook);

    res.json({ success: true, bookmarks: validBookmarks });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/bookmarks/check/:ebookId
 * Check if user has bookmarked a specific ebook.
 */
async function checkBookmark(req, res, next) {
  try {
    const bookmark = await Bookmark.findOne({
      user: req.user._id,
      ebook: req.params.ebookId,
    });

    res.json({
      success: true,
      bookmarked: !!bookmark,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  toggleBookmark,
  getBookmarks,
  checkBookmark,
};
