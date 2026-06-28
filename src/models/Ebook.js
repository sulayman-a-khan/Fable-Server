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
      max: [999.99, 'Price cannot exceed $999.99'],
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
      min: 0,
    },
    // Estimated reading time in minutes (computed on save)
    readingTimeMinutes: {
      type: Number,
      default: 0,
    },
    // Optional short excerpt for previews (auto-populated from description)
    excerpt: {
      type: String,
      maxlength: [500, 'Excerpt cannot exceed 500 characters'],
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

// Auto-compute readingTimeMinutes and excerpt before saving
ebookSchema.pre('save', function (next) {
  if (this.isModified('description') && this.description) {
    const wordCount = this.description.trim().split(/\s+/).length;
    this.readingTimeMinutes = Math.max(1, Math.round(wordCount / 200)); // ~200 wpm
    if (!this.excerpt || this.isModified('description')) {
      this.excerpt = this.description.substring(0, 400).trim();
      if (this.description.length > 400) this.excerpt += '…';
    }
  }
  next();
});

// Text index for full-text search
ebookSchema.index({ title: 'text', description: 'text' });
ebookSchema.index({ genre: 1 });
ebookSchema.index({ writer: 1 });
ebookSchema.index({ status: 1 });
ebookSchema.index({ price: 1 });
ebookSchema.index({ createdAt: -1 });
ebookSchema.index({ totalSold: -1 });

module.exports = mongoose.model('Ebook', ebookSchema);
