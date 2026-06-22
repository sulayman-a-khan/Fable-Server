const axios = require('axios');
const multer = require('multer');
const path = require('path');
const { AppError } = require('../utils/errorHandler');

// Configure multer for memory storage (no disk write)
const storage = multer.memoryStorage();

// Allowed MIME types (allow-list)
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(
        new AppError(
          'Invalid file type. Only JPEG, PNG, and WebP images are allowed.',
          400
        ),
        false
      );
      return;
    }
    cb(null, true);
  },
});

/**
 * POST /api/upload/image
 * Upload an image to imgBB via server-side proxy.
 * Validates file type and size before uploading.
 */
async function uploadImage(req, res, next) {
  try {
    if (!req.file) {
      throw new AppError('No image file provided', 400);
    }

    const apiKey = process.env.IMGBB_API_KEY;
    if (!apiKey) {
      throw new AppError('Image upload service not configured', 503);
    }

    // Validate magic bytes for image types
    const buffer = req.file.buffer;
    if (!isValidImage(buffer, req.file.mimetype)) {
      throw new AppError('File content does not match declared type', 400);
    }

    // Upload to imgBB
    const base64Image = buffer.toString('base64');

    const formData = new URLSearchParams();
    formData.append('key', apiKey);
    formData.append('image', base64Image);

    const response = await axios.post(
      'https://api.imgbb.com/1/upload',
      formData.toString(),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 30000,
      }
    );

    if (!response.data?.data?.url) {
      throw new AppError('Image upload failed', 500);
    }

    res.json({
      success: true,
      imageUrl: response.data.data.url,
      displayUrl: response.data.data.display_url,
      deleteUrl: response.data.data.delete_url,
    });
  } catch (error) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return next(new AppError('File size exceeds 5MB limit', 400));
    }
    next(error);
  }
}

/**
 * Validate image magic bytes against declared MIME type.
 */
function isValidImage(buffer, mimeType) {
  if (buffer.length < 4) return false;

  switch (mimeType) {
    case 'image/jpeg':
      // JPEG: starts with FF D8 FF
      return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    case 'image/png':
      // PNG: starts with 89 50 4E 47
      return (
        buffer[0] === 0x89 &&
        buffer[1] === 0x50 &&
        buffer[2] === 0x4e &&
        buffer[3] === 0x47
      );
    case 'image/webp':
      // WebP: starts with RIFF....WEBP
      return (
        buffer.length >= 12 &&
        buffer[0] === 0x52 &&
        buffer[1] === 0x49 &&
        buffer[2] === 0x46 &&
        buffer[3] === 0x46 &&
        buffer[8] === 0x57 &&
        buffer[9] === 0x45 &&
        buffer[10] === 0x42 &&
        buffer[11] === 0x50
      );
    default:
      return false;
  }
}

module.exports = {
  upload,
  uploadImage,
};
