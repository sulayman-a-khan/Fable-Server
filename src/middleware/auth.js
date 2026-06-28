const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { getSecret } = require('../utils/getSecret');

const JWT_SECRET = getSecret('JWT_SECRET', 'jwt_secret.txt');
const ALGORITHM = 'HS256';
const REFRESH_HINT_THRESHOLD_MS = 24 * 60 * 60 * 1000;

/**
 * Authentication middleware.
 * Extracts JWT from HttpOnly cookie, verifies it, and attaches user to request.
 */
async function authenticate(req, res, next) {
  try {
    let token = req.cookies?.['fable_token'];

    // Fallback: check Authorization header
    if (!token && req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. Please log in.',
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET, {
      algorithms: [ALGORITHM],
    });

    if (!decoded.exp) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token: missing expiration',
      });
    }

    const expiresInMs = decoded.exp * 1000 - Date.now();
    if (expiresInMs < REFRESH_HINT_THRESHOLD_MS) {
      res.setHeader('X-Token-Expiring', 'true');
    }

    const user = await User.findById(decoded.userId).select('-password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User no longer exists',
      });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Session expired. Please log in again.',
      });
    }
    return res.status(401).json({
      success: false,
      message: 'Invalid authentication token',
    });
  }
}

/**
 * Optional authentication - doesn't fail if no token present.
 */
async function optionalAuth(req, res, next) {
  try {
    let token = req.cookies?.['fable_token'];

    if (!token && req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (token) {
      const decoded = jwt.verify(token, JWT_SECRET, {
        algorithms: [ALGORITHM],
      });
      if (decoded.exp) {
        const user = await User.findById(decoded.userId);
        if (user) {
          req.user = user;
        }
      }
    }
  } catch {
    // Silently ignore auth errors for optional auth
  }
  next();
}

/**
 * Generate JWT token for a user.
 */
function generateToken(userId) {
  return jwt.sign({ userId }, JWT_SECRET, {
    algorithm: ALGORITHM,
    expiresIn: '7d',
  });
}

/**
 * Set JWT token as HttpOnly cookie.
 * Uses plain fable_token name — __Host- prefix is blocked cross-origin (Vercel → Render).
 */
function setTokenCookie(res, token) {
  const isProduction = process.env.NODE_ENV === 'production';
  res.cookie('fable_token', token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  });
}

/**
 * Clear the auth cookie.
 */
function clearTokenCookie(res) {
  const isProduction = process.env.NODE_ENV === 'production';
  res.clearCookie('fable_token', {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    path: '/',
  });
}

module.exports = {
  authenticate,
  optionalAuth,
  generateToken,
  setTokenCookie,
  clearTokenCookie,
  JWT_SECRET,
};
