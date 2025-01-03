const { db } = require('../config/firebase-config');
const { admin } = require('../config/firebase-config');
class AuthController {
  // Register new user
  async register(req, res) {
    try {
      const userData = req.body;
      const { uid } = req.user;

      // Create user document in Firestore
      const userRef = db.collection('users').doc(uid);
      
      // Prepare user data
      const userDoc = {
        ...userData,
        uid,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      await userRef.set(userDoc);

      // Get the created user data
      const user = await userRef.get();

      res.status(201).json({
        token: req.headers.authorization?.split('Bearer ')[1],
        user: {
          uid,
          ...user.data()
        }
      });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({ message: 'Registration failed', error: error.message });
    }
  }

  // Login user
  async login(req, res) {
    try {
      const { uid } = req.user;
      
      // Get user from Firestore
      const userRef = db.collection('users').doc(uid);
      const userDoc = await userRef.get();

      if (!userDoc.exists) {
        return res.status(404).json({ message: 'User not found' });
      }

      res.json({
        token: req.headers.authorization?.split('Bearer ')[1],
        user: {
          uid,
          ...userDoc.data()
        }
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ message: 'Login failed', error: error.message });
    }
  }

  // Get current user
  async getCurrentUser(req, res) {
    try {
      const { uid } = req.user;
      
      // Get user from Firestore
      const userRef = db.collection('users').doc(uid);
      const userDoc = await userRef.get();

      if (!userDoc.exists) {
        return res.status(404).json({ message: 'User not found' });
      }

      res.json({
        user: {
          uid,
          ...userDoc.data()
        }
      });
    } catch (error) {
      console.error('Get user error:', error);
      res.status(500).json({ message: 'Failed to fetch user data', error: error.message });
    }
  }

  // Update user profile
  async updateProfile(req, res) {
    try {
      const { uid } = req.user;
      const updateData = req.body;

      // Remove any protected fields from update data
      const { uid: _, createdAt, ...validUpdateData } = updateData;

      // Update user in Firestore
      const userRef = db.collection('users').doc(uid);
      await userRef.update({
        ...validUpdateData,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Get updated user data
      const updatedDoc = await userRef.get();

      res.json({
        user: {
          uid,
          ...updatedDoc.data()
        }
      });
    } catch (error) {
      console.error('Update profile error:', error);
      res.status(500).json({ message: 'Failed to update profile', error: error.message });
    }
  }

  // Delete user account
  async deleteAccount(req, res) {
    try {
      const { uid } = req.user;

      // Delete user from Firebase Auth
      await admin.auth().deleteUser(uid);

      // Delete user document from Firestore
      await db.collection('users').doc(uid).delete();

      res.json({ message: 'Account deleted successfully' });
    } catch (error) {
      console.error('Delete account error:', error);
      res.status(500).json({ message: 'Failed to delete account', error: error.message });
    }
  }
}

module.exports = { AuthController };
