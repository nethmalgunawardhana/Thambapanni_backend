const express = require('express');
const {
  submitGuideApplication,
  adminVerifyApplication,
  getVerifiedGuides,
  confirmGuideRequest,
  handleGuideResponse,
  getGuideConfirmationStatus,
} = require('../controllers/guideController');
const { getApplicationStatus } = require('../controllers/guideController');
const upload = require('../middleware/upload');
const { verifyToken } = require('../middleware/authMiddleware');
const RateLimit = require('express-rate-limit');
const router = express.Router();

// Set up rate limiter: maximum of 100 requests per 15 minutes
const limiter = RateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // max 100 requests per windowMs
  message: 'Too many requests from this IP, please try again after 15 minutes',
});

// Apply rate limiting to all routes
router.use(limiter);

// POST /api/guides/apply
router.post('/apply', verifyToken, submitGuideApplication);

// GET /api/guides/admin-verify
router.get('/admin-verify', verifyToken, adminVerifyApplication);

// GET /api/guides/status
router.get('/status', verifyToken, getApplicationStatus);

// GET /api/guides/verified
router.get('/verified', getVerifiedGuides);

// POST /api/guides/request-confirmation
router.post('/request-confirmation', verifyToken, confirmGuideRequest);

// GET /api/guides/guide-response
router.get('/guide-response', verifyToken, handleGuideResponse);

// GET /api/guides/confirmation-status/:tripId
router.get('/confirmation-status/:tripId', verifyToken, getGuideConfirmationStatus);

module.exports = router;