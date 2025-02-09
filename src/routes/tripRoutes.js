const express = require('express');
const { generateTripPlan, getTripPlansByUserId,getAllTripPlans } = require('../controllers/tripController');

const router = express.Router();

router.post('/generate-trip-plan', generateTripPlan);
router.get('/public', getAllTripPlans);
router.get('/user/:userId', getTripPlansByUserId);

module.exports = router;
