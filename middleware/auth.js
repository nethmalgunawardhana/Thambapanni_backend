const admin = require('../config/firebase-config');
const { CustomError } = require('../utils/errors');

exports.verifyFirebaseToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      throw new CustomError('No token provided', 401);
    }

    const token = authHeader.split(' ')[1];
    const decodedToken = await admin.auth().verifyIdToken(token);
    req.user = decodedToken;
    next();
  } catch (error) {
    next(new CustomError('Invalid token', 401));
  }
};
