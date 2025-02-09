const express = require('express');
const { serveDestinationImage } = require('../controllers/imageController');

const router = express.Router();

router.get('/destination-images/:destination', serveDestinationImage);

module.exports = router;
