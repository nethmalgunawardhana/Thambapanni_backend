const express = require('express');
const { registerUser, loginUser,verifyEmail } = require('../controllers/authcontroller');
const { validateRequest } = require('../middleware/auth');
const { verifyToken } = require('../middleware/authMiddleware');

const router = express.Router();

// Public routes
router.post('/register', registerUser);
router.post('/login', validateRequest, loginUser);
router.get('/verify-email', verifyEmail);
// Protected routes
router.get('/profile', verifyToken, (req, res) => {
  res.status(200).json({ message: 'Access granted to profile', user: req.user });
});

module.exports = router;
