const express = require('express');
const router = express.Router();
const {verifyToken} =require('../middleware/authMiddleware') 
const {getUserProfile,updateProfile,uploadProfilePhoto } = require('../controllers/usercontroller');
const upload = require('../middleware/upload');


router.get('/profile', verifyToken,getUserProfile);
router.put('/profile-update', verifyToken, updateProfile);
router.post('/upload-photo',upload.single('profilePhoto'),uploadProfilePhoto);

module.exports = router;