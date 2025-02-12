const express = require('express');
const { submitGuideApplication , adminVerifyApplication , getVerifiedGuides} = require('../controllers/guideController');
const { getApplicationStatus } = require('../controllers/guideController');
const upload = require('../middleware/upload');
const { verifyToken } = require('../middleware/authMiddleware');

const router = express.Router();

// POST /api/guides/apply
router.post('/apply', verifyToken,submitGuideApplication);
router.get('/admin-verify',adminVerifyApplication);
router.get('/status',verifyToken,getApplicationStatus)
// GET /api/guides/verified
router.get('/verified', getVerifiedGuides);

module.exports = router;
