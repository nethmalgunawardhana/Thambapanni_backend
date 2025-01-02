const express = require('express');
const router = express.Router();

const { verifyFirebaseToken } = require('../middleware/auth');
const AuthController = require('../../controllers/auth.controller');

const authController = new AuthController();

router.post('/register',
  verifyFirebaseToken,
  authController.register
);

router.post('/login',
  verifyFirebaseToken,
  authController.login
);

module.exports = router;