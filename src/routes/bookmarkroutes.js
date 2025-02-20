const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/authMiddleware');
const bookmarkController = require('../controllers/bookmarkcontroller');


router.get('/ids', verifyToken, bookmarkController.getBookmarkedIds);
router.post('/add', verifyToken, bookmarkController.addBookmark);
router.post('/remove', verifyToken, bookmarkController.removeBookmark);
router.get('/get', verifyToken, bookmarkController.getBookmarkedTrips);

module.exports = router;