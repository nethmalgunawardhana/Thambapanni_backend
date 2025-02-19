const express = require('express');
const RateLimit = require('express-rate-limit');
const { generateTripPlan, getTripPlansByUserId,getAllTripPlans } = require('../controllers/tripController');

const router = express.Router();

// set up rate limiter: maximum of 100 requests per 15 minutes
const limiter = RateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // max 100 requests per windowMs
});

router.post('/generate-trip-plan', generateTripPlan);
router.get('/public', getAllTripPlans);
router.get('/my-trips', limiter, getTripPlansByUserId);

module.exports = router;
