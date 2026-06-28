const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const {
  register,
  registerValidation,
  login,
  loginValidation,
  googleLogin,
  logout,
  getMe,
  setRole,
  roleValidation,
  changePassword,
} = require('../controllers/authController');

router.post('/register', registerValidation, validate, register);
router.post('/login', loginValidation, validate, login);
router.post('/google', googleLogin);
router.post('/logout', logout);
router.get('/me', authenticate, getMe);
router.patch('/role', authenticate, roleValidation, validate, setRole);
router.post('/change-password', authenticate, changePassword);

module.exports = router;
