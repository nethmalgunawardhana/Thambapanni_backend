const express = require('express');
const router = express.Router();
const {verifyToken} =require('../middleware/authMiddleware') 
const {getUserProfile,updateProfile } = require('../controllers/usercontroller');



router.get('/profile', verifyToken,getUserProfile);
router.put('/profile-update', verifyToken, updateProfile);

module.exports = router;