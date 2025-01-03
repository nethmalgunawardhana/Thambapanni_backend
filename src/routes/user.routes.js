const { Router } = require('express');
const { AuthController } = require('../controllers/auth.controller');
const { authMiddleware } = require('../middleware/auth');

const router = Router();
const authController = new AuthController();

router.post('/register', authMiddleware, authController.register.bind(authController));
router.post('/login', authMiddleware, authController.login.bind(authController));
router.post('/google-login', authMiddleware, authController.login.bind(authController));
router.post('/facebook-login', authMiddleware, authController.login.bind(authController));
router.get('/me', authMiddleware, authController.getCurrentUser.bind(authController));
router.put('/profile', authMiddleware, authController.updateProfile.bind(authController));
router.delete('/account', authMiddleware, authController.deleteAccount.bind(authController));
module.exports = router;