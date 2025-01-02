const jwt = require('jsonwebtoken');
const UserService = require('../services/user.service');
const { CustomError } = require('../utils/errors');

const JWT_SECRET = process.env.JWT_SECRET;
const TOKEN_EXPIRY = '24h';

class AuthController {
  constructor() {
    this.userService = new UserService();
  }

  register = async (req, res, next) => {
    try {
      const userData = await this.userService.createUser({
        ...req.body,
        uid: req.user.uid 
      });

      const token = this.generateToken(userData);

      res.status(201).json({
        message: 'User registered successfully',
        token,
        user: userData
      });
    } catch (error) {
      next(error);
    }
  };

  login = async (req, res, next) => {
    try {
      const userData = await this.userService.getUserById(req.user.uid);
      const token = this.generateToken(userData);

      res.json({
        token,
        user: userData
      });
    } catch (error) {
      next(error);
    }
  };

  _generateToken(userData) {
    return jwt.sign(
      {
        uid: userData.uid,
        email: userData.email,
      },
      JWT_SECRET,
      { expiresIn: TOKEN_EXPIRY }
    );
  }
}

module.exports = AuthController;