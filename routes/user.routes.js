const express = require('express');
const router = express.Router();

const jwt = require('jsonwebtoken');
const UserService = require('../services/user.service');
const { verifyFirebaseToken } = require('../middleware/auth');

const userService = new UserService();
const JWT_SECRET = process.env.JWT_SECRET || 'your-jwt-secret';
const TOKEN_EXPIRY = '24h';

// Register new user
router.post('/register', async (req, res) => {
  try {
    const userData = await userService.createUser(req.body);
    res.status(201).json({
      message: 'User registered successfully',
      user: userData,
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      error: 'Registration failed',
      details: error.message,
    });
  }
});
// Get user profile
router.get('/profile', verifyFirebaseToken, async (req, res) => {
  try {
    const userData = await userService.getUserById(req.user.uid);
    res.json({ user: userData });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});
// Update user profile
router.patch('/profile', verifyFirebaseToken, async (req, res) => {
  try {
    const userData = await userService.updateUser(req.user.uid, req.body);
    res.json({
      message: 'Profile updated successfully',
      user: userData,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Delete user
router.delete('/profile', verifyFirebaseToken, async (req, res) => {
  try {
    await userService.deleteUser(req.user.uid);
    await auth.deleteUser(req.user.uid);
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

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