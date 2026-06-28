const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const {
  toggleBookmark,
  getBookmarks,
  checkBookmark,
  getBookmarkCount,
} = require('../controllers/bookmarkController');

router.post('/:ebookId', authenticate, toggleBookmark);
router.get('/', authenticate, getBookmarks);
router.get('/check/:ebookId', authenticate, checkBookmark);
router.get('/count/:ebookId', getBookmarkCount); // public — no auth needed

module.exports = router;
