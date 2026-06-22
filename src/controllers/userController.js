const User = require('../models/User');
const Ebook = require('../models/Ebook');
const { AppError } = require('../utils/errorHandler');

/**
 * GET /api/users
 * Get all users (admin only).
 */
async function getUsers(req, res, next) {
  try {
    const users = await User.find()
      .select('-password')
      .sort({ createdAt: -1 });

    res.json({ success: true, users });
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /api/users/:id/role
 * Change a user's role (admin only).
 */
async function changeUserRole(req, res, next) {
  try {
    const { role } = req.body;

    if (!['user', 'writer', 'admin'].includes(role)) {
      throw new AppError('Invalid role', 400);
    }

    const user = await User.findById(req.params.id);

    if (!user) {
      throw new AppError('User not found', 404);
    }

    // Prevent removing the last admin
    if (user.role === 'admin' && role !== 'admin') {
      const adminCount = await User.countDocuments({ role: 'admin' });
      if (adminCount <= 1) {
        throw new AppError('Cannot remove the last admin', 400);
      }
    }

    user.role = role;
    await user.save();

    res.json({
      success: true,
      message: `User role changed to ${role}`,
      user: user.toJSON(),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /api/users/:id
 * Delete a user (admin only).
 */
async function deleteUser(req, res, next) {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      throw new AppError('User not found', 404);
    }

    // Prevent deleting yourself
    if (user._id.toString() === req.user._id.toString()) {
      throw new AppError('You cannot delete your own account', 400);
    }

    // Prevent deleting the last admin
    if (user.role === 'admin') {
      const adminCount = await User.countDocuments({ role: 'admin' });
      if (adminCount <= 1) {
        throw new AppError('Cannot delete the last admin', 400);
      }
    }

    await user.deleteOne();

    res.json({
      success: true,
      message: 'User deleted successfully',
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/users/top-writers
 * Get top 3 writers by total sales.
 */
async function getTopWriters(req, res, next) {
  try {
    const topWriters = await Ebook.aggregate([
      { $match: { status: 'published' } },
      {
        $group: {
          _id: '$writer',
          totalSold: { $sum: '$totalSold' },
          ebookCount: { $sum: 1 },
        },
      },
      { $sort: { totalSold: -1 } },
      { $limit: 3 },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'writerInfo',
        },
      },
      { $unwind: '$writerInfo' },
      {
        $project: {
          _id: '$writerInfo._id',
          name: '$writerInfo.name',
          avatar: '$writerInfo.avatar',
          totalSold: 1,
          ebookCount: 1,
        },
      },
    ]);

    res.json({ success: true, writers: topWriters });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getUsers,
  changeUserRole,
  deleteUser,
  getTopWriters,
};
