const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { upload, uploadImage } = require('../controllers/uploadController');

router.post('/image', authenticate, upload.single('image'), uploadImage);

module.exports = router;
