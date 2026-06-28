/**
 * Centralized error handling middleware.
 * Returns generic messages to clients, logs details server-side.
 * Never exposes database errors or stack traces to the user.
 */
function errorHandler(err, req, res, _next) {
  // Log detailed error for developers (no credentials or tokens)
  console.error(`[ERROR] ${req.method} ${req.path}:`, {
    message: err.message,
    status: err.statusCode || 500,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    timestamp: new Date().toISOString(),
  });

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map((e) => e.message);
    return res.status(400).json({
      success: false,
      message: messages[0] || 'Validation failed',
      errors: messages,
    });
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    const friendlyField = field === 'email' ? 'email address' : field;
    return res.status(409).json({
      success: false,
      message: `This ${friendlyField} is already in use`,
    });
  }

  // Mongoose cast error (invalid ObjectId)
  if (err.name === 'CastError') {
    return res.status(400).json({
      success: false,
      message: 'Invalid resource ID format',
    });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      message: 'Invalid authentication token. Please log in again.',
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      message: 'Your session has expired. Please log in again.',
    });
  }

  // Multer / file upload errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      success: false,
      message: 'Uploaded file is too large. Maximum size is 5MB.',
    });
  }

  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({
      success: false,
      message: 'Unexpected file field in upload',
    });
  }

  // Stripe errors (avoid leaking internal Stripe details)
  if (err.type && err.type.startsWith('Stripe')) {
    return res.status(402).json({
      success: false,
      message: 'Payment processing failed. Please check your payment details.',
    });
  }

  // Custom application errors
  const statusCode = err.statusCode || 500;
  const message =
    statusCode === 500
      ? 'An unexpected error occurred. Please try again later.'
      : err.message;

  res.status(statusCode).json({
    success: false,
    message,
  });
}

/**
 * Custom error class with status code
 */
class AppError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
    this.name = 'AppError';
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = { errorHandler, AppError };
