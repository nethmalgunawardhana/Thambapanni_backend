const express = require('express');
const { createPaymentIntent ,handlePaymentSuccess,getPaymentHistory  } = require('../controllers/paymentController');

const router = express.Router();

router.post('/create-payment-intent', createPaymentIntent);
// Handle successful payment and store in Firestore
router.post('/handle-success', handlePaymentSuccess);

// Get user payment history
router.get('/history', getPaymentHistory );


module.exports = router;