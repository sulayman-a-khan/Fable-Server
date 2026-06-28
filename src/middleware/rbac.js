/**
 * Role-Based Access Control middleware.
 * Validates that the authenticated user has one of the allowed roles.
 * Must be used AFTER the authenticate middleware.
 */
function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Required role: ${allowedRoles.join(' or ')}`,
      });
    }

    next();
  };
}

/**
 * Middleware that ensures the requesting user owns the resource OR is an admin.
 * Attaches isAdmin and isSelf flags to req for downstream use.
 * Usage: selfOrAdmin('userId') — pass the req.params key holding the target user ID.
 */
function selfOrAdmin(paramKey = 'id') {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const targetId = req.params[paramKey];
    const isAdmin = req.user.role === 'admin';
    const isSelf = req.user._id.toString() === targetId;

    if (!isAdmin && !isSelf) {
      return res.status(403).json({
        success: false,
        message: 'You can only access your own resources',
      });
    }

    req.isAdmin = isAdmin;
    req.isSelf = isSelf;
    next();
  };
}

module.exports = { authorize, selfOrAdmin };
