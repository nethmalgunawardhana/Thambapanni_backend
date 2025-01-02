const { db, timestamp, timestampFromDate } = require('../config/firebase-admin');

class UserService {
  constructor() {
    this.collection = db.collection('users');
  }

  async createUser(userData) {
    try {
      // Create user document with timestamps
      const userDoc = {
        ...userData,
        dateOfBirth: timestampFromDate(new Date(userData.dateOfBirth)),
        createdAt: timestamp,
        updatedAt: timestamp,
      };

      // Save to Firestore
      await this.collection.doc(userData.uid).set(userDoc);

      // Return the created user data
      return this.getUserById(userData.uid);
    } catch (error) {
      console.error('Error creating user:', error);
      throw new Error('Failed to create user');
    }
  }

  async getUserById(uid) {
    try {
      const userDoc = await this.collection.doc(uid).get();

      if (!userDoc.exists) {
        throw new Error('User not found');
      }

      return userDoc.data();
    } catch (error) {
      console.error('Error fetching user:', error);
      throw new Error('Failed to fetch user');
    }
  }

  async updateUser(uid, updates) {
    try {
      const updateData = {
        ...updates,
        updatedAt: timestamp,
      };

      if (updates.dateOfBirth) {
        updateData.dateOfBirth = timestampFromDate(new Date(updates.dateOfBirth));
      }

      await this.collection.doc(uid).update(updateData);
      return this.getUserById(uid);
    } catch (error) {
      console.error('Error updating user:', error);
      throw new Error('Failed to update user');
    }
  }

  async deleteUser(uid) {
    try {
      await this.collection.doc(uid).delete();
    } catch (error) {
      console.error('Error deleting user:', error);
      throw new Error('Failed to delete user');
    }
  }
}

module.exports = UserService;