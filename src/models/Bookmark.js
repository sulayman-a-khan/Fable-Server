const mongoose = require('mongoose');

const bookmarkSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User is required'],
    },
    ebook: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Ebook',
      required: [true, 'Ebook is required'],
    },
  },
  {
    timestamps: true,
  }
);

// Each user can bookmark an ebook only once
bookmarkSchema.index({ user: 1, ebook: 1 }, { unique: true });

module.exports = mongoose.model('Bookmark', bookmarkSchema);
