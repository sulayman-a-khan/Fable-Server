const User = require('../models/User');
const Ebook = require('../models/Ebook');
const Transaction = require('../models/Transaction');

/**
 * GET /api/analytics/overview
 * Get admin dashboard overview stats.
 */
async function getOverview(req, res, next) {
  try {
    const [totalUsers, totalWriters, totalEbooks, salesData] =
      await Promise.all([
        User.countDocuments(),
        User.countDocuments({ role: 'writer' }),
        Ebook.countDocuments(),
        Transaction.aggregate([
          { $match: { status: 'completed' } },
          {
            $group: {
              _id: null,
              totalSold: { $sum: 1 },
              totalRevenue: { $sum: '$amount' },
            },
          },
        ]),
      ]);

    const stats = salesData[0] || { totalSold: 0, totalRevenue: 0 };

    res.json({
      success: true,
      overview: {
        totalUsers,
        totalWriters,
        totalEbooks,
        totalSold: stats.totalSold,
        totalRevenue: stats.totalRevenue,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/analytics/monthly-sales
 * Get monthly sales data for charts (last 12 months).
 */
async function getMonthlySales(req, res, next) {
  try {
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

    const monthlySales = await Transaction.aggregate([
      {
        $match: {
          status: 'completed',
          createdAt: { $gte: twelveMonthsAgo },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
          },
          sales: { $sum: 1 },
          revenue: { $sum: '$amount' },
        },
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1 },
      },
      {
        $project: {
          _id: 0,
          month: {
            $concat: [
              { $toString: '$_id.year' },
              '-',
              {
                $cond: [
                  { $lt: ['$_id.month', 10] },
                  { $concat: ['0', { $toString: '$_id.month' }] },
                  { $toString: '$_id.month' },
                ],
              },
            ],
          },
          sales: 1,
          revenue: 1,
        },
      },
    ]);

    res.json({ success: true, monthlySales });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/analytics/genre-distribution
 * Get ebook count by genre for pie chart.
 */
async function getGenreDistribution(req, res, next) {
  try {
    const genreData = await Ebook.aggregate([
      {
        $group: {
          _id: '$genre',
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      {
        $project: {
          _id: 0,
          genre: '$_id',
          count: 1,
        },
      },
    ]);

    res.json({ success: true, genreData });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getOverview,
  getMonthlySales,
  getGenreDistribution,
};
