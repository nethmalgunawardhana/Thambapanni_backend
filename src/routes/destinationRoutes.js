const express = require('express');
const router = express.Router();
const { getDestinationsByType } = require('../controllers/destinationController');

router.get('/type', getDestinationsByType);
module.exports = router;