const express = require('express');
const router = express.Router();
const { getTrendingDestinations } = require('../controllers/trendingController');

router.get('/trending-places', getTrendingDestinations);

module.exports = router;