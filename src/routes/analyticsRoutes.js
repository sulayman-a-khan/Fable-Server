const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const {
  getOverview,
  getMonthlySales,
  getGenreDistribution,
} = require('../controllers/analyticsController');

// All analytics routes are admin only
router.get('/overview', authenticate, authorize('admin'), getOverview);
router.get('/monthly-sales', authenticate, authorize('admin'), getMonthlySales);
router.get(
  '/genre-distribution',
  authenticate,
  authorize('admin'),
  getGenreDistribution
);

module.exports = router;
