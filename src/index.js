require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');

const { errorHandler } = require('./utils/errorHandler');
const { handleWebhook } = require('./controllers/transactionController');

// Route imports
const authRoutes = require('./routes/authRoutes');
const ebookRoutes = require('./routes/ebookRoutes');
const transactionRoutes = require('./routes/transactionRoutes');
const userRoutes = require('./routes/userRoutes');
const bookmarkRoutes = require('./routes/bookmarkRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const uploadRoutes = require('./routes/uploadRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// --- Security Middleware ---

// Helmet for security headers
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https://i.ibb.co', 'https://i.ibb.co.com'],
        connectSrc: ["'self'"],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  })
);

// Additional security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=()'
  );
  next();
});

// CORS — strict origin (no wildcard)
const allowedOrigins = [
  process.env.CLIENT_URL || 'http://localhost:3000',
];

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (mobile apps, curl, etc.)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // limit each IP to 200 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests. Please try again later.',
  },
});

app.use(limiter);

// Stricter rate limit for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: {
    success: false,
    message: 'Too many authentication attempts. Please try again later.',
  },
});

// --- Stripe Webhook (needs raw body BEFORE json parser) ---
app.post(
  '/api/transactions/webhook',
  express.raw({ type: 'application/json' }),
  handleWebhook
);

// --- Body Parsers ---
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// --- Routes ---
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/ebooks', ebookRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/users', userRoutes);
app.use('/api/bookmarks', bookmarkRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/upload', uploadRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'Fable API is running', timestamp: new Date().toISOString() });
});

// --- Error Handling ---
app.use(errorHandler);

// --- Database Connection & Server Start ---
async function startServer() {
  try {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      console.error('[FATAL] MONGODB_URI environment variable is not set');
      process.exit(1);
    }

    await mongoose.connect(mongoUri);
    console.log('[DB] Connected to MongoDB');

    // Seed admin user if not exists
    await seedAdmin();

    app.listen(PORT, () => {
      console.log(`[SERVER] Fable API running on port ${PORT}`);
    });
  } catch (error) {
    console.error('[FATAL] Failed to start server:', error.message);
    process.exit(1);
  }
}

/**
 * Seed the default admin user if not already present.
 */
async function seedAdmin() {
  const User = require('./models/User');

  try {
    const adminExists = await User.findOne({ email: 'admin@fable.com' });
    if (!adminExists) {
      await User.create({
        name: 'Admin',
        email: 'admin@fable.com',
        password: 'Admin@123',
        role: 'admin',
      });
      console.log('[SEED] Admin user created (admin@fable.com)');
    }
  } catch (error) {
    console.error('[SEED] Failed to seed admin:', error.message);
  }
}

startServer();

module.exports = app;
