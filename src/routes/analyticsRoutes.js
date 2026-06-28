const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const {
  getOverview,
  getMonthlySales,
  getGenreDistribution,
  getGenreRevenue,
  getTopEbooks,
  getWriterStats,
} = require('../controllers/analyticsController');

// All analytics routes are admin only
router.get('/overview', authenticate, authorize('admin'), getOverview);
router.get('/monthly-sales', authenticate, authorize('admin'), getMonthlySales);
router.get('/genre-distribution', authenticate, authorize('admin'), getGenreDistribution);
router.get('/genre-revenue', authenticate, authorize('admin'), getGenreRevenue);
router.get('/top-ebooks', authenticate, authorize('admin'), getTopEbooks);
router.get('/writer-stats', authenticate, authorize('writer', 'admin'), getWriterStats);

module.exports = router;
