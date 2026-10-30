const express = require('express');
const router  = express.Router();
const crypto  = require('crypto');
const jwt     = require('jsonwebtoken');
const svgCaptcha = require('svg-captcha');
const User    = require('../models/User');
const { protect, authorize } = require('../middleware/auth');
const { sendOTPEmail } = require('../utils/emailService');
const ttlStore = require('../utils/ttlStore');
const studentPassword = require('../utils/studentPassword');
const { readKey } = require('./sync');

const FIVE_MIN = 5 * 60 * 1000;
const randomId = () => crypto.randomBytes(16).toString('hex');
const randomOtp = () => String(crypto.randomInt(100000, 1000000));

const sessionToken = (payload) =>
  jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE || '12h' });

const maskEmail = (email) => String(email || '').replace(/(.{3})(.*)(@.*)/, '$1***$3');

// Never print OTPs in production logs.
function logDevOtp(label, otp) {
  if (process.env.NODE_ENV !== 'production') console.log(`[DEV] ${label} OTP: ${otp}`);
}

async function sendOtp(user, otp, label) {
  logDevOtp(label, otp);
  try {
    await sendOTPEmail(user.email || process.env.EMAIL_USER, otp);
  } catch (err) {
    console.error('[EMAIL ERROR] Failed to send OTP email:', err.message);
  }
}

// Limit attempts per IP (and per login ID when given) inside a time window.
const attempts = new Map();
function loginLimiter(limit, windowMs) {
  return (req, res, next) => {
    const id = String((req.body && req.body.loginId) || '').toLowerCase();
    const key = req.path + '|' + req.ip + '|' + id;
    const now = Date.now();
    const recent = (attempts.get(key) || []).filter(t => now - t < windowMs);
    if (recent.length >= limit) {
      return res.status(429).json({ success: false, message: 'Too many attempts. Please wait 15 minutes and try again.' });
    }
    recent.push(now);
    attempts.set(key, recent);
    next();
  };
}
const limitLogin = loginLimiter(10, 15 * 60 * 1000);

// @route   GET /api/auth/captcha
// @access  Public
router.get('/captcha', async (req, res) => {
  const captcha = svgCaptcha.create({
    size: 6, noise: 4, color: true, ignoreChars: '0oO1ilI', background: '#f1f5f9', width: 180, height: 50, fontSize: 38
  });
  const captchaId = randomId();
  await ttlStore.set('captcha', captchaId, captcha.text, FIVE_MIN);
  res.json({
    success: true,
    captchaId,
    image: `data:image/svg+xml;base64,${Buffer.from(captcha.data).toString('base64')}`
  });
});

// @route   POST /api/auth/register-admin
// @desc    One-time setup: only works while no admin account exists.
router.post('/register-admin', async (req, res) => {
  const { loginId, password, email } = req.body;
  try {
    const admins = await User.find({ role: 'admin' });
    if (admins.length > 0) {
      return res.status(403).json({ success: false, message: 'An admin account already exists.' });
    }
    if (!loginId || !password || password.length < 8) {
      return res.status(400).json({ success: false, message: 'Login ID and a password of at least 8 characters are required.' });
    }
    await User.create({ loginId, password, role: 'admin', email: email || process.env.EMAIL_USER });
    res.status(201).json({ success: true, message: 'Admin account created. Please log in.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Could not create admin.' });
  }
});

// @route   POST /api/auth/login
// @desc    Admin step 1: CAPTCHA + password, then an OTP is emailed.
router.post('/login', limitLogin, async (req, res) => {
  const { loginId, password, captchaId, captcha } = req.body;
  try {
    if (!captchaId || !captcha) {
      return res.status(400).json({ success: false, message: 'Please enter the verification code (CAPTCHA).' });
    }
    const storedText = await ttlStore.get('captcha', captchaId);
    await ttlStore.del('captcha', captchaId); // one attempt per CAPTCHA
    if (!storedText) {
      return res.status(400).json({ success: false, message: 'The verification code expired. Please try the new one.', captchaExpired: true });
    }
    if (storedText !== String(captcha).trim()) {
      return res.status(400).json({ success: false, message: 'Incorrect verification code. Please try again.' });
    }

    const user = await User.findOne({ loginId: String(loginId || '') });
    if (!user || user.role !== 'admin' || !(await user.matchPassword(String(password || '')))) {
      return res.status(401).json({ success: false, message: 'Invalid credentials. Please check User ID and Password.' });
    }

    const otp = randomOtp();
    await ttlStore.set('otp', user.loginId, otp, FIVE_MIN);
    await ttlStore.set('otp-pending', user.loginId, '1', 3 * FIVE_MIN);
    await sendOtp(user, otp, 'Admin login');

    res.json({
      success: true,
      requireOTP: true,
      loginId: user.loginId,
      message: `A verification code (OTP) has been sent to your registered email (${maskEmail(user.email || process.env.EMAIL_USER)}).`
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Login failed. Please try again.' });
  }
});

// @route   POST /api/auth/resend-otp
// @desc    Admin: resend the login OTP. Only works while a login OTP is pending.
router.post('/resend-otp', limitLogin, async (req, res) => {
  const loginId = String(req.body.loginId || '');
  try {
    const pending = await ttlStore.get('otp-pending', loginId);
    const user = pending ? await User.findOne({ loginId }) : null;
    if (!user) return res.status(400).json({ success: false, message: 'Please log in again.' });
    const otp = randomOtp();
    await ttlStore.set('otp', loginId, otp, FIVE_MIN);
    await sendOtp(user, otp, 'Admin login (resend)');
    res.json({ success: true, message: 'A new verification code has been sent.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Could not resend the code.' });
  }
});

// @route   POST /api/auth/verify-otp
// @desc    Admin step 2: OTP -> session token
router.post('/verify-otp', limitLogin, async (req, res) => {
  const loginId = String(req.body.loginId || '');
  const otp = String(req.body.otp || '').trim();
  try {
    if (!loginId || !otp) {
      return res.status(400).json({ success: false, message: 'Please enter the 6-digit verification code.' });
    }
    const storedOtp = await ttlStore.get('otp', loginId);
    if (!storedOtp) {
      return res.status(400).json({ success: false, message: 'The verification code expired. Please click Resend OTP.' });
    }
    if (storedOtp !== otp) {
      return res.status(400).json({ success: false, message: 'Incorrect verification code. Please try again.' });
    }
    await ttlStore.del('otp', loginId);
    await ttlStore.del('otp-pending', loginId);

    const user = await User.findOne({ loginId });
    if (!user || user.role !== 'admin') return res.status(404).json({ success: false, message: 'Admin user not found' });

    const token = sessionToken({ id: String(user._id), role: 'admin', loginId: user.loginId });
    res.json({ success: true, token, user: { loginId: user.loginId, role: 'admin' } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Verification failed. Please try again.' });
  }
});

// @route   POST /api/auth/student-login
router.post('/student-login', limitLogin, async (req, res) => {
  const loginId = String(req.body.loginId || '').trim();
  const password = String(req.body.password || '');
  try {
    if (!loginId || !password) {
      return res.status(400).json({ success: false, message: 'Please enter your Login ID and password.' });
    }
    const archived = await readKey('archived', []);
    if (archived.find(s => s.loginId === loginId)) {
      return res.status(403).json({ success: false, message: 'Your account is no longer active. Please contact school administration.' });
    }
    const students = await readKey('students', []);
    const student = students.find(s => s.loginId === loginId && s.status === 'active');
    if (!student || !studentPassword.verify(password, student.password)) {
      return res.status(401).json({ success: false, message: 'Invalid Login ID or Password' });
    }
    const token = sessionToken({ id: 'stu:' + student.id, role: 'student', loginId: student.loginId, studentId: student.id });
    const { password: _omit, ...profile } = student;
    res.json({ success: true, token, student: profile });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Login failed. Please try again.' });
  }
});

// @route   GET /api/auth/me
router.get('/me', protect, (req, res) => {
  res.json({ success: true, user: { loginId: req.user.loginId, role: req.user.role, studentId: req.user.studentId } });
});

// @route   POST /api/auth/reauth/request
// @desc    Admin re-authentication for critical actions: password -> emailed OTP
router.post('/reauth/request', protect, authorize('admin'), limitLogin, async (req, res) => {
  const { loginId, password } = req.body;
  try {
    const user = await User.findById(req.user._id);
    const ok = user && String(loginId || '') === user.loginId && (await user.matchPassword(String(password || '')));
    if (!ok) return res.status(401).json({ success: false, message: 'Invalid User ID or Password.' });

    const otp = randomOtp();
    await ttlStore.set('reauth', user.loginId, otp, FIVE_MIN);
    await sendOtp(user, otp, 'Re-authentication');
    res.json({ success: true, message: `A verification code has been sent to ${maskEmail(user.email || process.env.EMAIL_USER)}.` });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Could not send the verification code.' });
  }
});

// @route   POST /api/auth/reauth/verify
// @desc    OTP -> short-lived re-auth token (required to change credentials)
router.post('/reauth/verify', protect, authorize('admin'), limitLogin, async (req, res) => {
  const otp = String(req.body.otp || '').trim();
  try {
    const stored = await ttlStore.get('reauth', req.user.loginId);
    if (!stored || stored !== otp) {
      return res.status(400).json({ success: false, message: stored ? 'Incorrect OTP code. Please try again.' : 'The code expired. Please request a new one.' });
    }
    await ttlStore.del('reauth', req.user.loginId);
    const reauthToken = jwt.sign({ id: String(req.user._id), purpose: 'reauth' }, process.env.JWT_SECRET, { expiresIn: '10m' });
    res.json({ success: true, reauthToken });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Verification failed.' });
  }
});

// @route   PUT /api/auth/credentials
// @desc    Change admin login ID and/or password (needs a re-auth token)
router.put('/credentials', protect, authorize('admin'), async (req, res) => {
  const { reauthToken, newLoginId, newPassword } = req.body;
  try {
    let decoded;
    try { decoded = jwt.verify(String(reauthToken || ''), process.env.JWT_SECRET); } catch (e) { decoded = null; }
    if (!decoded || decoded.purpose !== 'reauth' || decoded.id !== String(req.user._id)) {
      return res.status(401).json({ success: false, message: 'Please verify your identity again.' });
    }

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ success: false, message: 'Admin user not found' });

    if (newLoginId) {
      if (String(newLoginId).length < 6) return res.status(400).json({ success: false, message: 'User ID must be at least 6 characters.' });
      const existing = await User.findOne({ loginId: newLoginId });
      if (existing && String(existing._id) !== String(user._id)) {
        return res.status(400).json({ success: false, message: 'Username already in use.' });
      }
      user.loginId = newLoginId;
    }
    if (newPassword) {
      const strong = newPassword.length >= 8 && /[A-Z]/.test(newPassword) && /[a-z]/.test(newPassword) && /\d/.test(newPassword) && /[^A-Za-z0-9]/.test(newPassword);
      if (!strong) return res.status(400).json({ success: false, message: 'Password must be at least 8 characters with uppercase, lowercase, number and special character.' });
      if (await user.matchPassword(newPassword)) return res.status(400).json({ success: false, message: 'New password cannot be the same as the current one.' });
      user.password = newPassword;
    }
    await user.save();
    res.json({ success: true, message: 'Admin credentials updated.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Could not update credentials.' });
  }
});

module.exports = router;
