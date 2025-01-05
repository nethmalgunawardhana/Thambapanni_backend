const express = require('express');
const { registerUser, loginUser } = require('../controllers/authController');
const { validateRequest } = require('../middleware/auth');
const { verifyToken } = require('../middleware/authMiddleware');

const router = express.Router();

// Public routes
router.post('/register', registerUser);
router.post('/login', validateRequest, loginUser);

// Protected routes
router.get('/profile', verifyToken, (req, res) => {
  res.status(200).json({ message: 'Access granted to profile', user: req.user });
});

module.exports = router;
