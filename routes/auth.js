const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { verifyFirebaseToken } = require('../middleware/auth');

const JWT_SECRET = process.env.JWT_SECRET || 'your-jwt-secret';
const TOKEN_EXPIRY = '24h';

router.post('/login', verifyFirebaseToken, async (req, res) => {
  try {
    const { uid, email } = req.user;
    
    // Create JWT token
    const token = jwt.sign(
      { 
        uid, 
        email,
      },
      JWT_SECRET,
      { expiresIn: TOKEN_EXPIRY }
    );

    res.json({ token });
  } catch (error) {
    res.status(500).json({ error: 'Authentication failed' });
  }
});

// Example protected route
router.get('/profile', verifyJWT, async (req, res) => {
  try {
    // Access user data from req.user
    const { uid, email } = req.user;
    
    // Fetch user profile from your database
    // const userProfile = await UserModel.findOne({ uid });
    
    res.json({ 
      message: 'Profile accessed successfully',
      user: { uid, email }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

module.exports = router;