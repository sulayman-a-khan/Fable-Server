const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const {
  getUsers,
  changeUserRole,
  deleteUser,
  getTopWriters,
} = require('../controllers/userController');

// Public
router.get('/top-writers', getTopWriters);

// Admin only
router.get('/', authenticate, authorize('admin'), getUsers);
router.patch('/:id/role', authenticate, authorize('admin'), changeUserRole);
router.delete('/:id', authenticate, authorize('admin'), deleteUser);

module.exports = router;
