const Stripe = require('stripe');
const Ebook = require('../models/Ebook');
const Transaction = require('../models/Transaction');
const { AppError } = require('../utils/errorHandler');

function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new AppError('Payment service is not configured', 503);
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY);
}

/**
 * POST /api/transactions/checkout
 * Create a Stripe checkout session for ebook purchase.
 */
async function createCheckoutSession(req, res, next) {
  try {
    const { ebookId } = req.body;

    if (!ebookId) {
      throw new AppError('Ebook ID is required', 400);
    }

    const ebook = await Ebook.findById(ebookId).populate('writer', 'name');

    if (!ebook) {
      throw new AppError('Ebook not found', 404);
    }

    if (ebook.status !== 'published') {
      throw new AppError('This ebook is not available for purchase', 400);
    }

    // Prevent writer from buying their own ebook
    if (req.user._id.toString() === ebook.writer._id.toString()) {
      throw new AppError('You cannot purchase your own ebook', 400);
    }

    // Check if already purchased
    const existingPurchase = await Transaction.findOne({
      buyer: req.user._id,
      ebook: ebook._id,
      status: 'completed',
    });

    if (existingPurchase) {
      throw new AppError('You have already purchased this ebook', 400);
    }

    const stripe = getStripe();
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: ebook.title,
              description: `By ${ebook.writer.name}`,
              images: ebook.coverImage ? [ebook.coverImage] : [],
            },
            unit_amount: Math.round(ebook.price * 100), // Stripe uses cents
          },
          quantity: 1,
        },
      ],
      metadata: {
        ebookId: ebook._id.toString(),
        buyerId: req.user._id.toString(),
        writerId: ebook.writer._id.toString(),
      },
      success_url: `${clientUrl}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${clientUrl}/ebooks/${ebook._id}`,
    });

    // Create pending transaction
    await Transaction.create({
      ebook: ebook._id,
      buyer: req.user._id,
      writer: ebook.writer._id,
      amount: ebook.price,
      stripeSessionId: session.id,
      type: 'purchase',
      status: 'pending',
    });

    res.json({
      success: true,
      sessionUrl: session.url,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/transactions/webhook
 * Handle Stripe webhook events.
 */
async function handleWebhook(req, res, next) {
  try {
    const stripe = getStripe();
    const sig = req.headers['stripe-signature'];

    if (!process.env.STRIPE_WEBHOOK_SECRET) {
      throw new AppError('Webhook secret not configured', 503);
    }

    let event;
    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.error('Webhook signature verification failed');
      return res.status(400).json({ success: false, message: 'Webhook verification failed' });
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;

      // Update transaction status
      const transaction = await Transaction.findOne({
        stripeSessionId: session.id,
      });

      if (transaction && transaction.status !== 'completed') {
        transaction.status = 'completed';
        await transaction.save();

        // Increment ebook totalSold
        await Ebook.findByIdAndUpdate(transaction.ebook, {
          $inc: { totalSold: 1 },
        });
      }
    }

    res.json({ received: true });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/transactions/confirm
 * Confirm a transaction after Stripe checkout (fallback for webhooks).
 */
async function confirmTransaction(req, res, next) {
  try {
    const { sessionId } = req.body;

    if (!sessionId) {
      throw new AppError('Session ID is required', 400);
    }

    const transaction = await Transaction.findOne({
      stripeSessionId: sessionId,
    });

    if (!transaction) {
      throw new AppError('Transaction not found', 404);
    }

    if (transaction.buyer.toString() !== req.user._id.toString()) {
      throw new AppError('Unauthorized', 403);
    }

    if (transaction.status === 'completed') {
      return res.json({
        success: true,
        message: 'Payment already confirmed',
        transaction,
      });
    }

    // Verify with Stripe
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status === 'paid') {
      transaction.status = 'completed';
      await transaction.save();

      await Ebook.findByIdAndUpdate(transaction.ebook, {
        $inc: { totalSold: 1 },
      });
    }

    res.json({
      success: true,
      message: 'Payment confirmed',
      transaction,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/transactions/user
 * Get user's purchase history.
 */
async function getUserPurchases(req, res, next) {
  try {
    const transactions = await Transaction.find({
      buyer: req.user._id,
      status: 'completed',
    })
      .populate('ebook', 'title coverImage price genre')
      .populate('writer', 'name')
      .sort({ createdAt: -1 });

    res.json({ success: true, transactions });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/transactions/writer
 * Get writer's sales history.
 */
async function getWriterSales(req, res, next) {
  try {
    const transactions = await Transaction.find({
      writer: req.user._id,
      status: 'completed',
    })
      .populate('ebook', 'title coverImage price')
      .populate('buyer', 'name email')
      .sort({ createdAt: -1 });

    res.json({ success: true, transactions });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/transactions/all
 * Get all transactions (admin only).
 */
async function getAllTransactions(req, res, next) {
  try {
    const transactions = await Transaction.find()
      .populate('ebook', 'title price')
      .populate('buyer', 'name email')
      .populate('writer', 'name email')
      .sort({ createdAt: -1 });

    res.json({ success: true, transactions });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/transactions/check/:ebookId
 * Check if user has purchased a specific ebook.
 */
async function checkPurchase(req, res, next) {
  try {
    const transaction = await Transaction.findOne({
      buyer: req.user._id,
      ebook: req.params.ebookId,
      status: 'completed',
    });

    res.json({
      success: true,
      purchased: !!transaction,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createCheckoutSession,
  handleWebhook,
  confirmTransaction,
  getUserPurchases,
  getWriterSales,
  getAllTransactions,
  checkPurchase,
};
