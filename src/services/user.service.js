const { db } = require('../src/config/firebase-admin');
const { CustomError } = require('../utils/errors');

class UserService {
  constructor() {
    this.collection = db.collection('users');
  }

  async createUser(userData) {
    try {
      const userDoc = {
        ...userData,
        dateOfBirth: new Date(userData.dateOfBirth),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await this.collection.doc(userData.uid).set(userDoc);
      return this.getUserById(userData.uid);
    } catch (error) {
      throw new CustomError('Failed to create user', 500);
    }
  }

  async getUserById(uid) {
    try {
      const userDoc = await this.collection.doc(uid).get();
      
      if (!userDoc.exists) {
        throw new CustomError('User not found', 404);
      }

      return { uid, ...userDoc.data() };
    } catch (error) {
      if (error instanceof CustomError) throw error;
      throw new CustomError('Failed to fetch user', 500);
    }
  }

  async updateUser(uid, updates) {
    try {
      const updateData = {
        ...updates,
        updatedAt: new Date()
      };

      await this.collection.doc(uid).update(updateData);
      return this.getUserById(uid);
    } catch (error) {
      throw new CustomError('Failed to update user', 500);
    }
  }

  async deleteUser(uid) {
    try {
      await this.collection.doc(uid).delete();
    } catch (error) {
      throw new CustomError('Failed to delete user', 500);
    }
  }
}

module.exports = UserService;
