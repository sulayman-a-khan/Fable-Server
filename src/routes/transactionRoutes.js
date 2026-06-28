const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const {
  createCheckoutSession,
  confirmTransaction,
  getUserPurchases,
  getWriterSales,
  getAllTransactions,
  checkPurchase,
  getPurchaseSummary,
} = require('../controllers/transactionController');

// All transaction routes require authentication
router.post('/checkout', authenticate, createCheckoutSession);
router.post('/confirm', authenticate, confirmTransaction);
router.get('/user', authenticate, getUserPurchases);
router.get('/summary', authenticate, getPurchaseSummary);
router.get('/writer', authenticate, authorize('writer', 'admin'), getWriterSales);
router.get('/all', authenticate, authorize('admin'), getAllTransactions);
router.get('/check/:ebookId', authenticate, checkPurchase);

module.exports = router;
