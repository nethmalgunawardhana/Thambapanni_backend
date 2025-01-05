const express = require('express');
const { registerUser, loginUser } = require('../controllers/authController');
const { validateRequest } = require('../middleware/auth');

const router = express.Router();

// Register route
router.post('/register', registerUser);

// Login route with middleware
router.post('/login', validateRequest, loginUser);

module.exports = router;
