const express = require('express');
const { generateTripPlan } = require('../controllers/tripController');

const router = express.Router();

router.post('/generate-trip-plan', generateTripPlan);

module.exports = router;
