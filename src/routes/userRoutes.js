const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const {
  getUsers,
  changeUserRole,
  deleteUser,
  getTopWriters,
  updateProfile,
} = require('../controllers/userController');

// Public
router.get('/top-writers', getTopWriters);

// Authenticated user
router.patch('/profile', authenticate, updateProfile);

// Admin only
router.get('/', authenticate, authorize('admin'), getUsers);
router.patch('/:id/role', authenticate, authorize('admin'), changeUserRole);
router.delete('/:id', authenticate, authorize('admin'), deleteUser);

module.exports = router;
