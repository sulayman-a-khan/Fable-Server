const express = require('express');
const router = express.Router();
const { authenticate, optionalAuth } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const { validate } = require('../middleware/validate');
const {
  getEbooks,
  getFeaturedEbooks,
  getEbook,
  getEbooksByWriter,
  createEbook,
  createEbookValidation,
  updateEbook,
  updateEbookStatus,
  statusValidation,
  deleteEbook,
} = require('../controllers/ebookController');

// Public routes
router.get('/', optionalAuth, getEbooks);
router.get('/featured', getFeaturedEbooks);
router.get('/writer/:writerId', optionalAuth, getEbooksByWriter);
router.get('/:id', optionalAuth, getEbook);

// Protected routes (writer)
router.post(
  '/',
  authenticate,
  authorize('writer', 'admin'),
  createEbookValidation,
  validate,
  createEbook
);

router.put(
  '/:id',
  authenticate,
  authorize('writer', 'admin'),
  updateEbook
);

router.patch(
  '/:id/status',
  authenticate,
  authorize('writer', 'admin'),
  statusValidation,
  validate,
  updateEbookStatus
);

router.delete(
  '/:id',
  authenticate,
  authorize('writer', 'admin'),
  deleteEbook
);

module.exports = router;
