const jwt = require('jsonwebtoken');
const User = require('../models/User');
// Protect Routes (Verify JWT Token)
const protect = async (req, res, next) => {
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      // Get token from header (Format: Bearer <token>)
      token = req.headers.authorization.split(' ')[1];
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'supersecretjwtkeychangeinproduction');
      req.user = await User.findById(decoded.id).select('-password');
      
      if (!req.user) {
        return res.status(401).json({ success: false, message: 'Not authorized, user not found' });
      }
      next();
    } catch (error) {
      console.error(error);
      return res.status(401).json({ success: false, message: 'Not authorized, token verification failed' });
    }
  }
  if (!token) {
    return res.status(401).json({ success: false, message: 'Not authorized, token is missing' });
  }
};
// Authorize Roles
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: User role '${req.user ? req.user.role : 'none'}' is not authorized to access this resource`
      });
    }
    next();
  };
};
module.exports = { protect, authorize };