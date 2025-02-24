const express = require('express');
const RateLimit = require('express-rate-limit');
const { createPaymentIntent ,handlePaymentSuccess,getPaymentHistory  } = require('../controllers/paymentController');

const router = express.Router();

// Configure rate limiter: maximum of 100 requests per 15 minutes
const limiter = RateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // max 100 requests per windowMs
});

router.post('/create-payment-intent', createPaymentIntent);
// Handle successful payment and store in Firestore
router.post('/handle-success', handlePaymentSuccess);

// Get user payment history
router.get('/history', limiter, getPaymentHistory );


module.exports = router;