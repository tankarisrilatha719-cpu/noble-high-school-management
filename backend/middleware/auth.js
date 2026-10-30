const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Tokens carry { id, role, loginId } and, for students, { studentId }.
// Admin tokens are re-checked against the users collection so a deleted or
// renamed admin loses access immediately. Student accounts live in the
// 'students' sync record, so their token payload is trusted as signed.
async function resolveUser(token) {
  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  if (decoded.role === 'student') {
    return { _id: decoded.id, role: 'student', loginId: decoded.loginId, studentId: decoded.studentId };
  }
  const user = await User.findById(decoded.id).select('-password');
  if (!user || user.role !== 'admin') return null;
  return user;
}

function readBearer(req) {
  const h = req.headers.authorization || '';
  return h.startsWith('Bearer ') ? h.slice(7) : null;
}

// Require a valid token.
const protect = async (req, res, next) => {
  const token = readBearer(req);
  if (!token) {
    return res.status(401).json({ success: false, message: 'Not authorized, token is missing' });
  }
  try {
    req.user = await resolveUser(token);
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Not authorized, user not found' });
    }
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Session expired. Please log in again.' });
  }
};

// Attach req.user when a valid token is present; continue anonymously otherwise.
const optionalAuth = async (req, res, next) => {
  const token = readBearer(req);
  if (token) {
    try { req.user = await resolveUser(token); } catch (e) { req.user = null; }
  }
  next();
};

// Authorize Roles
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to do this.'
      });
    }
    next();
  };
};

module.exports = { protect, optionalAuth, authorize };
