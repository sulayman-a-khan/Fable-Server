const mongoose = require('mongoose');

const ebookSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      maxlength: [50000, 'Description cannot exceed 50000 characters'],
    },
    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: [0, 'Price cannot be negative'],
    },
    genre: {
      type: String,
      required: [true, 'Genre is required'],
      enum: [
        'Fiction',
        'Mystery',
        'Romance',
        'Sci-Fi',
        'Fantasy',
        'Horror',
        'Thriller',
        'Non-Fiction',
        'Biography',
        'Self-Help',
        'History',
        'Poetry',
      ],
    },
    coverImage: {
      type: String,
      required: [true, 'Cover image is required'],
    },
    writer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Writer is required'],
    },
    status: {
      type: String,
      enum: ['published', 'unpublished'],
      default: 'published',
    },
    totalSold: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Text index for search
ebookSchema.index({ title: 'text', description: 'text' });
ebookSchema.index({ genre: 1 });
ebookSchema.index({ writer: 1 });
ebookSchema.index({ status: 1 });
ebookSchema.index({ price: 1 });
ebookSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Ebook', ebookSchema);
