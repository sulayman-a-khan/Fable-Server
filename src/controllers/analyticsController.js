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

/**
 * GET /api/analytics/genre-revenue
 * Get total revenue grouped by genre (joins transactions → ebooks).
 */
async function getGenreRevenue(req, res, next) {
  try {
    const data = await Transaction.aggregate([
      { $match: { status: 'completed' } },
      {
        $lookup: {
          from: 'ebooks',
          localField: 'ebook',
          foreignField: '_id',
          as: 'ebookData',
        },
      },
      { $unwind: '$ebookData' },
      {
        $group: {
          _id: '$ebookData.genre',
          revenue: { $sum: '$amount' },
          sales: { $sum: 1 },
        },
      },
      { $sort: { revenue: -1 } },
      {
        $project: {
          _id: 0,
          genre: '$_id',
          revenue: { $round: ['$revenue', 2] },
          sales: 1,
        },
      },
    ]);

    res.json({ success: true, genreRevenue: data });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/analytics/top-ebooks
 * Get the top 5 best-selling ebooks on the platform.
 */
async function getTopEbooks(req, res, next) {
  try {
    const topEbooks = await Ebook.find({ status: 'published' })
      .populate('writer', 'name')
      .sort({ totalSold: -1 })
      .limit(5)
      .select('title genre price totalSold coverImage writer');

    res.json({ success: true, topEbooks });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getOverview,
  getMonthlySales,
  getGenreDistribution,
  getGenreRevenue,
  getTopEbooks,
  getWriterStats,
};

/**
 * GET /api/analytics/writer-stats
 * Returns quick stats for the authenticated writer:
 * totalBooks, totalSold, totalRevenue, recentSales (last 5).
 */
async function getWriterStats(req, res, next) {
  try {
    const writerId = req.user._id;

    const [ebookCount, salesAgg, recentSales] = await Promise.all([
      require('../models/Ebook').countDocuments({ writer: writerId }),
      Transaction.aggregate([
        { $match: { writer: writerId, status: 'completed' } },
        { $group: { _id: null, totalRevenue: { $sum: '$amount' }, totalSold: { $sum: 1 } } },
      ]),
      Transaction.find({ writer: writerId, status: 'completed' })
        .sort({ createdAt: -1 })
        .limit(5)
        .populate('ebook', 'title coverImage')
        .populate('buyer', 'name'),
    ]);

    const agg = salesAgg[0] || { totalRevenue: 0, totalSold: 0 };

    res.json({
      success: true,
      stats: {
        totalBooks: ebookCount,
        totalSold: agg.totalSold,
        totalRevenue: parseFloat(agg.totalRevenue.toFixed(2)),
        recentSales,
      },
    });
  } catch (error) {
    next(error);
  }
}
