const jwt = require('jsonwebtoken');
const SECRET_KEY = process.env.SECRET_KEY; // Replace with an environment variable in production

exports.verifyToken = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'Authorization token required' });
    }

    const token = authHeader.split(' ')[1];
    
    try {
      const decoded = jwt.verify(token, process.env.SECRET_KEY);
      req.user = decoded
      req.userId = decoded.userId;
     
      next();
    } catch (error) {
      return res.status(401).json({ success: false, error: 'Invalid or expired token' });
    }
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(500).json({ success: false, error: 'Server error' });
  }
};
