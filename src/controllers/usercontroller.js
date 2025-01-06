const { db,admin } = require('../config/firebase');


exports.getUserProfile = async (req, res) => {
    try {
      // Get user ID from JWT token
      const userId = req.user.userId; // Assuming middleware sets this
  
      const userDoc = await db.collection('users').doc(userId).get();
      
      if (!userDoc.exists) {
        return res.status(404).json({ 
          success: false, 
          message: 'User not found' 
        });
      }
  
      const userData = userDoc.data();
      
      // Remove sensitive information
      const { password, ...userDataWithoutPassword } = userData;
  
      res.json({
        success: true,
        data: userDataWithoutPassword
      });
    } catch (error) {
      console.error('Error fetching user profile:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Error fetching user profile' 
      });
    }
  };
  
//update profile
  exports.updateProfile = async (req, res) => {
    try {
      const {
        firstName,
        lastName,
        email,
        nationality,
        gender,
        dateOfBirth,
        password,
        profilePhoto
      } = req.body;
  
      // Validate required fields
      const updates = {};
      
      if (firstName) updates.firstName = firstName;
      if (lastName) updates.lastName = lastName;
      if (email) updates.email = email;
      if (nationality) updates.nationality = nationality;
      if (gender) updates.gender = gender;
      if (dateOfBirth) updates.dateOfBirth = dateOfBirth;
      if (profilePhoto) updates.profilePhoto = profilePhoto;
  
      // If password is being updated, hash it
      if (password) {
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        updates.password = hashedPassword;
      }
  
      // Add timestamp
      updates.updatedAt = admin.firestore.FieldValue.serverTimestamp();
  
      // Update user document
      await db.collection('users').doc(req.user.uid).update(updates);
  
      // Fetch updated user data
      const updatedUserDoc = await db.collection('users').doc(req.user.uid).get();
      const userData = updatedUserDoc.data();
  
      // Remove sensitive information before sending response
      const { password: userPassword, ...userDataWithoutPassword } = userData;
  
      res.json({
        success: true,
        message: 'Profile updated successfully',
        data: userDataWithoutPassword
      });
  
    } catch (error) {
      console.error('Error updating profile:', error);
      
      // Handle specific errors
      if (error.code === 'auth/email-already-in-use') {
        return res.status(400).json({
          success: false,
          message: 'Email is already in use'
        });
      }
  
      res.status(500).json({
        success: false,
        message: 'Error updating profile'
      });
    }
  };
  
  // Helper function to validate email format
  const isValidEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };
  
  // Helper function to validate date format (YYYY-MM-DD)
  const isValidDate = (dateString) => {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    return dateRegex.test(dateString) && !isNaN(Date.parse(dateString));
  };