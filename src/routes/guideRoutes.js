const express = require('express');
const { submitGuideApplication , adminVerifyApplication , getVerifiedGuides,confirmGuideRequest, handleGuideResponse,
    getGuideConfirmationStatus} = require('../controllers/guideController');
const { getApplicationStatus } = require('../controllers/guideController');
const upload = require('../middleware/upload');
const { verifyToken } = require('../middleware/authMiddleware');
const RateLimit = require('express-rate-limit');
const router = express.Router();

// set up rate limiter: maximum of 100 requests per 15 minutes
const limiter = RateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // max 100 requests per windowMs
});
// POST /api/guides/apply
router.post('/apply', verifyToken,submitGuideApplication);
router.get('/admin-verify',adminVerifyApplication);
router.get('/status',verifyToken,getApplicationStatus)
// GET /api/guides/verified
router.get('/verified', getVerifiedGuides);
router.post('/request-confirmation', verifyToken,  limiter,confirmGuideRequest);
router.get('/guide-response',  limiter,handleGuideResponse);
router.get('/confirmation-status/:tripId', limiter,verifyToken, getGuideConfirmationStatus);

module.exports = router;
