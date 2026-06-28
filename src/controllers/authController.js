const { body } = require('express-validator');
const { OAuth2Client } = require('google-auth-library');
const User = require('../models/User');
const {
  generateToken,
  setTokenCookie,
  clearTokenCookie,
} = require('../middleware/auth');
const { AppError } = require('../utils/errorHandler');

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

/**
 * POST /api/auth/register
 * Register a new user with email + password.
 */
const registerValidation = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Name is required')
    .isLength({ max: 100 })
    .withMessage('Name cannot exceed 100 characters'),
  body('email')
    .trim()
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail(),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters'),
  body('confirmPassword').custom((value, { req }) => {
    if (value !== req.body.password) {
      throw new Error('Passwords do not match');
    }
    return true;
  }),
];

async function register(req, res, next) {
  try {
    const { name, email, password } = req.body;

    // Check if email already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      throw new AppError('An account with this email already exists', 409);
    }

    const user = await User.create({ name, email, password });

    const token = generateToken(user._id);
    setTokenCookie(res, token);

    res.status(201).json({
      success: true,
      message: 'Registration successful',
      user: user.toJSON(),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/auth/login
 * Login with email + password.
 */
const loginValidation = [
  body('email')
    .trim()
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required'),
];

async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    // Find user and include password field for comparison
    const user = await User.findOne({ email }).select('+password');

    if (!user) {
      throw new AppError('Invalid email or password', 401);
    }

    // Check if user registered with Google (no password)
    if (!user.password) {
      throw new AppError(
        'This account uses Google login. Please sign in with Google.',
        401
      );
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      throw new AppError('Invalid email or password', 401);
    }

    const token = generateToken(user._id);
    setTokenCookie(res, token);

    res.json({
      success: true,
      message: 'Login successful',
      user: user.toJSON(),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/auth/google
 * Handle Google OAuth login/registration.
 */
async function googleLogin(req, res, next) {
  try {
    const { token } = req.body;

    if (!token) {
      throw new AppError('Google authentication token is required', 400);
    }

    if (!process.env.GOOGLE_CLIENT_ID) {
      throw new AppError('Google Client ID is not configured on the server', 500);
    }

    // Verify token with Google
    const ticket = await googleClient.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload) {
      throw new AppError('Invalid Google authentication token payload', 400);
    }

    const { name, email, sub: googleId, picture: avatar } = payload;

    if (!email || !googleId) {
      throw new AppError('Google token is missing email or Google ID claims', 400);
    }

    let user = await User.findOne({ email });

    if (user) {
      // Link Google ID if not already linked
      if (!user.googleId) {
        user.googleId = googleId;
        if (avatar && !user.avatar) user.avatar = avatar;
        await user.save();
      }
    } else {
      // Create new user (role will be selected on frontend after redirect)
      user = await User.create({
        name: name || email.split('@')[0],
        email,
        googleId,
        avatar: avatar || '',
      });
    }

    const jwtToken = generateToken(user._id);
    setTokenCookie(res, jwtToken);

    res.json({
      success: true,
      message: 'Login successful',
      user: user.toJSON(),
    });
  } catch (error) {
    next(new AppError(error.message || 'Google token verification failed', 401));
  }
}

/**
 * POST /api/auth/logout
 * Logout user and clear auth cookie.
 */
async function logout(req, res) {
  clearTokenCookie(res);
  res.json({
    success: true,
    message: 'Logged out successfully',
  });
}

/**
 * GET /api/auth/me
 * Get current authenticated user.
 */
async function getMe(req, res) {
  res.json({
    success: true,
    user: req.user.toJSON(),
  });
}

/**
 * PATCH /api/auth/role
 * Set user role after registration (user or writer only).
 */
const roleValidation = [
  body('role')
    .isIn(['user', 'writer'])
    .withMessage('Role must be either user or writer'),
];

async function setRole(req, res, next) {
  try {
    const { role } = req.body;
    const user = await User.findById(req.user._id);

    if (!user) {
      throw new AppError('User not found', 404);
    }

    user.role = role;
    await user.save();

    res.json({
      success: true,
      message: `Role updated to ${role}`,
      user: user.toJSON(),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/auth/change-password
 * Allows authenticated users (non-Google) to change their password.
 */
async function changePassword(req, res, next) {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      throw new AppError('Both currentPassword and newPassword are required', 400);
    }
    if (newPassword.length < 8) {
      throw new AppError('New password must be at least 8 characters', 400);
    }

    const user = await User.findById(req.user._id).select('+password');
    if (!user) throw new AppError('User not found', 404);

    if (user.googleId && !user.password) {
      throw new AppError('Google-authenticated accounts cannot change password here', 400);
    }

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) throw new AppError('Current password is incorrect', 401);

    user.password = newPassword;
    await user.save();

    res.json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    next(error);
  }
}

module.exports = {
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
};
