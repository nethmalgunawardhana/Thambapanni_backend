const express = require('express');
const { sendOtp, resetPassword, verifyOtp } = require('../controllers/otpcontroller');

const router = express.Router();

router.post('/send-otp', sendOtp);
router.post('/reset-password', resetPassword);
router.post('/verify-otp', verifyOtp);

module.exports = router;
