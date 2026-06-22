const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const {
  toggleBookmark,
  getBookmarks,
  checkBookmark,
} = require('../controllers/bookmarkController');

router.post('/:ebookId', authenticate, toggleBookmark);
router.get('/', authenticate, getBookmarks);
router.get('/check/:ebookId', authenticate, checkBookmark);

module.exports = router;
