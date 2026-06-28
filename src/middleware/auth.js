const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { getSecret } = require('../utils/getSecret');

const JWT_SECRET = getSecret('JWT_SECRET', 'jwt_secret.txt');
const ALGORITHM = 'HS256';
// Token expiry window — if token has less than 1 day left, add a header hint
const REFRESH_HINT_THRESHOLD_MS = 24 * 60 * 60 * 1000;

/**
 * Authentication middleware.
 * Extracts JWT from HttpOnly cookie, verifies it, and attaches user to request.
 * Also adds X-Token-Expiring header if token expires within 24 hours.
 */
async function authenticate(req, res, next) {
  try {
    const token = req.cookies?.['__Host-fable_token'] || req.cookies?.['fable_token'];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. Please log in.',
      });
    }

    // Verify with hardcoded algorithm; rejects 'none' algorithm
    const decoded = jwt.verify(token, JWT_SECRET, {
      algorithms: [ALGORITHM],
    });

    // Validate exp claim
    if (!decoded.exp) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token: missing expiration',
      });
    }

    // Hint client to refresh if expiring soon
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
 * Used for public pages that show different content for logged-in users.
 */
async function optionalAuth(req, res, next) {
  try {
    const token = req.cookies?.['__Host-fable_token'] || req.cookies?.['fable_token'];
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
 */
function setTokenCookie(res, token) {
  const isProduction = process.env.NODE_ENV === 'production';
  const req = res.req;
  const isSecureConnection = req ? (req.secure || req.headers['x-forwarded-proto'] === 'https') : false;
  const useSecure = isProduction && isSecureConnection;
  const cookieName = useSecure ? '__Host-fable_token' : 'fable_token';

  const cookieOptions = {
    httpOnly: true,
    secure: useSecure,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: '/',
  };

  // __Host- prefix requires no domain attribute
  if (!useSecure) {
    cookieOptions.domain = undefined;
  }

  res.cookie(cookieName, token, cookieOptions);
}

/**
 * Clear the auth cookie.
 */
function clearTokenCookie(res) {
  const isProduction = process.env.NODE_ENV === 'production';
  const req = res.req;
  const isSecureConnection = req ? (req.secure || req.headers['x-forwarded-proto'] === 'https') : false;
  const useSecure = isProduction && isSecureConnection;
  const cookieName = useSecure ? '__Host-fable_token' : 'fable_token';

  res.clearCookie(cookieName, {
    httpOnly: true,
    secure: useSecure,
    sameSite: 'lax',
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
