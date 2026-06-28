const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema(
  {
    ebook: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Ebook',
      required: [true, 'Ebook is required'],
    },
    buyer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Buyer is required'],
    },
    writer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Writer is required'],
    },
    amount: {
      type: Number,
      required: [true, 'Amount is required'],
      min: [0, 'Amount cannot be negative'],
    },
    stripeSessionId: {
      type: String,
      required: [true, 'Stripe session ID is required'],
      unique: true,
    },
    type: {
      type: String,
      enum: ['purchase'],
      default: 'purchase',
    },
    status: {
      type: String,
      enum: ['completed', 'pending', 'failed'],
      default: 'pending',
    },
    // Currency code for future multi-currency support
    currency: {
      type: String,
      default: 'usd',
      lowercase: true,
    },
    // Refund tracking
    refunded: {
      type: Boolean,
      default: false,
    },
    refundedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index to prevent duplicate purchases
transactionSchema.index({ buyer: 1, ebook: 1 });
transactionSchema.index({ writer: 1 });
transactionSchema.index({ status: 1 });
transactionSchema.index({ createdAt: -1 });
transactionSchema.index({ stripeSessionId: 1 }, { unique: true });

module.exports = mongoose.model('Transaction', transactionSchema);
