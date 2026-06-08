const express = require('express');
const router  = express.Router();
const jwt     = require('jsonwebtoken');
const svgCaptcha = require('svg-captcha');
const User    = require('../models/User');
const Student = require('../models/Student');
const { protect, authorize } = require('../middleware/auth');
const { sendOTPEmail } = require('../utils/emailService');

// FIX #3: File-backed TTL store instead of plain in-memory Maps.
//         CAPTCHA and OTP entries now survive server restarts.
const ttlStore = require('../utils/ttlStore');
ttlStore.purgeAll(); // clean up stale entries from previous runs on startup

// Helper to generate unique identifiers
const generateId = () => Math.random().toString(36).substring(2, 15);

// Generate JWT token helper
const generateToken = (id) => {
  // FIX #2: JWT_SECRET must be set — no hardcoded fallback.
  //         Server will have already exited at startup if it's missing.
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '24h'
  });
};

// @route   GET /api/auth/captcha
// @desc    Generate a dynamic SVG CAPTCHA
// @access  Public
router.get('/captcha', (req, res) => {
  const captcha = svgCaptcha.create({
    size: 6,
    noise: 4,
    color: true,
    background: '#f1f5f9',
    width: 180,
    height: 50,
    fontSize: 38
  });

  const captchaId = generateId();
  const TTL_5_MIN = 5 * 60 * 1000;

  // FIX #3: Persist to file instead of in-memory Map
  ttlStore.set('captcha', captchaId, captcha.text, TTL_5_MIN);

  res.json({
    success: true,
    captchaId,
    image: `data:image/svg+xml;base64,${Buffer.from(captcha.data).toString('base64')}`
  });
});

// @route   POST /api/auth/register-admin
// @desc    Register a new admin (Setup utility)
// @access  Public (Lock down in production)
router.post('/register-admin', async (req, res) => {
  const { loginId, password, email } = req.body;
  try {
    let user = await User.findOne({ loginId });
    if (user) {
      return res.status(400).json({ success: false, message: 'Admin user already exists' });
    }
    user = await User.create({
      loginId,
      password,
      role: 'admin',
      email: email || process.env.EMAIL_USER
    });
    const token = generateToken(user._id);
    res.status(201).json({
      success: true,
      token,
      user: { id: user._id, loginId: user.loginId, role: user.role, email: user.email }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @route   POST /api/auth/login
// @desc    Authenticate User & get token or send OTP for admin
// @access  Public
router.post('/login', async (req, res) => {
  const { loginId, password, captchaId, captcha } = req.body;
  try {
    const user = await User.findOne({ loginId });
    if (!user) return res.status(401).json({ success: false, message: 'Invalid credentials' });

    const isMatch = await user.matchPassword(password);
    if (!isMatch) return res.status(401).json({ success: false, message: 'Invalid credentials' });

    if (user.role === 'admin') {
      // 1. CAPTCHA check
      if (!captchaId || !captcha) {
        return res.status(400).json({ success: false, message: 'Verification Code (CAPTCHA) is required for admin access' });
      }

      // FIX #3: Read from persistent store instead of in-memory Map
      const storedText = ttlStore.get('captcha', captchaId);
      if (!storedText) {
        return res.status(400).json({ success: false, message: 'CAPTCHA code expired. Please refresh the verification code.' });
      }
      if (storedText.toLowerCase() !== captcha.trim().toLowerCase()) {
        return res.status(400).json({ success: false, message: 'Incorrect Verification Code. Please try again.' });
      }
      ttlStore.del('captcha', captchaId); // one-time use

      // 2. Generate 6-digit OTP
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const TTL_5_MIN = 5 * 60 * 1000;

      // FIX #3: Persist OTP to file
      ttlStore.set('otp', loginId, otp, TTL_5_MIN);

      const adminEmail = user.email || process.env.EMAIL_USER;
      console.log(`\n======================================================`);
      console.log(`[DEVELOPER OTP BYPASS] Generated OTP for Admin: ${otp}`);
      console.log(`======================================================\n`);

      try {
        await sendOTPEmail(adminEmail, otp);
      } catch (emailErr) {
        console.error('[EMAIL ERROR] Failed to send OTP email via SMTP:', emailErr.message);
        console.log('[DEVELOPER BYPASS] Use the OTP printed above to log in.');
      }

      const maskedEmail = adminEmail.replace(/(.{3})(.*)(@.*)/, '$1***$3');
      return res.json({
        success: true,
        requireOTP: true,
        loginId,
        message: `A verification code (OTP) has been sent to your registered email (${maskedEmail})`
      });
    }

    // Student login — direct, no 2FA
    const token = generateToken(user._id);
    const studentDetails = await Student.findOne({ loginId: user.loginId });
    res.json({
      success: true,
      token,
      user: { id: user._id, loginId: user.loginId, role: user.role, studentInfo: studentDetails }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @route   POST /api/auth/verify-otp
// @desc    Verify OTP for admin and issue session token
// @access  Public
router.post('/verify-otp', async (req, res) => {
  const { loginId, otp } = req.body;
  try {
    if (!loginId || !otp) {
      return res.status(400).json({ success: false, message: 'Username and verification code are required.' });
    }

    // FIX #3: Read from persistent store
    const storedOtp = ttlStore.get('otp', loginId);
    if (!storedOtp) {
      return res.status(400).json({ success: false, message: 'Verification code expired or not found. Please log in again.' });
    }
    if (storedOtp !== otp.trim()) {
      return res.status(400).json({ success: false, message: 'Incorrect verification code. Please try again.' });
    }

    ttlStore.del('otp', loginId); // one-time use

    const user = await User.findOne({ loginId });
    if (!user) return res.status(404).json({ success: false, message: 'Admin user not found' });

    const token = generateToken(user._id);
    res.json({
      success: true,
      token,
      user: { id: user._id, loginId: user.loginId, role: user.role }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @route   GET /api/auth/me
// @desc    Get current logged-in user
// @access  Private
router.get('/me', protect, async (req, res) => {
  try {
    let studentDetails = null;
    if (req.user.role === 'student') {
      studentDetails = await Student.findOne({ loginId: req.user.loginId });
    }
    res.json({
      success: true,
      user: { id: req.user._id, loginId: req.user.loginId, role: req.user.role, studentInfo: studentDetails }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @route   POST /api/auth/send-otp-monolith
// @desc    Send OTP for self-contained HTML monolith
// @access  Public
router.post('/send-otp-monolith', async (req, res) => {
  const { otp } = req.body;
  try {
    if (!otp) return res.status(400).json({ success: false, message: 'OTP is required' });
    const adminEmail = process.env.EMAIL_USER;
    await sendOTPEmail(adminEmail, otp);
    res.json({ success: true, message: 'OTP sent successfully to registered admin email' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/verify-credentials', async (req, res) => {
  const { loginId, password, role } = req.body;
  console.log(`[LOGIN DEBUG] Received login attempt. ID: "${loginId}", Role: "${role}", Password Length: ${password ? password.length : 0}`);
  try {
    const escaped = (loginId || '').replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const user = await User.findOne({ loginId: { $regex: new RegExp('^' + escaped + '$', 'i') } });
    if (!user) {
      console.log(`[LOGIN DEBUG] User "${loginId}" NOT found in database.`);
      return res.json({ success: false, message: 'Invalid username' });
    }
    console.log(`[LOGIN DEBUG] Found user: "${user.loginId}", Role: "${user.role}", Email: "${user.email}"`);
    if (role && user.role !== role) {
      console.log(`[LOGIN DEBUG] Role mismatch. Expected: "${role}", Found: "${user.role}"`);
      return res.json({ success: false, message: 'Role mismatch' });
    }

    const isMatch = await user.matchPassword(password);
    console.log(`[LOGIN DEBUG] Password match result: ${isMatch}`);
    if (!isMatch) return res.json({ success: false, message: 'Invalid password' });

    let studentInfo = null;
    if (user.role === 'student') {
      studentInfo = await Student.findOne({ loginId: { $regex: new RegExp('^' + escaped + '$', 'i') } });
    }
    res.json({ success: true, role: user.role, studentInfo });
  } catch (err) {
    console.error(`[LOGIN DEBUG] Error:`, err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// @route   POST /api/auth/reset-credentials-monolith
// @desc    Reset admin credentials (authenticates using current pwd first)
// @access  Public
router.post('/reset-credentials-monolith', async (req, res) => {
  const { currentLoginId, currentPassword, newLoginId, newPassword } = req.body;
  try {
    const user = await User.findOne({ loginId: currentLoginId, role: 'admin' });
    if (!user) return res.json({ success: false, message: 'Invalid current credentials' });

    const isMatch = await user.matchPassword(currentPassword);
    if (!isMatch) return res.json({ success: false, message: 'Invalid current credentials' });

    if (newLoginId) {
      const existing = await User.findOne({ loginId: newLoginId });
      if (existing && existing._id.toString() !== user._id.toString()) {
        return res.json({ success: false, message: 'New username already in use' });
      }
      user.loginId = newLoginId;
    }
    if (newPassword) user.password = newPassword;
    await user.save();
    res.json({ success: true, message: 'Admin credentials successfully updated in backend.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @route   POST /api/auth/request-otp-action
// @desc    Request OTP for a sensitive admin action
// @access  Private (Admin Only)
router.post('/request-otp-action', protect, authorize('admin'), async (req, res) => {
  try {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const TTL_5_MIN = 5 * 60 * 1000;

    // FIX #3: Persist OTP to file
    ttlStore.set('otp', req.user.loginId, otp, TTL_5_MIN);

    const adminEmail = req.user.email || process.env.EMAIL_USER;
    console.log(`\n======================================================`);
    console.log(`[DEVELOPER OTP BYPASS] Generated OTP for Admin Action: ${otp}`);
    console.log(`======================================================\n`);

    try {
      await sendOTPEmail(adminEmail, otp);
    } catch (emailErr) {
      console.error('[EMAIL ERROR] Failed to send OTP email:', emailErr.message);
    }

    const maskedEmail = adminEmail.replace(/(.{3})(.*)(@.*)/, '$1***$3');
    res.json({
      success: true,
      message: `A verification code (OTP) has been sent to your registered email (${maskedEmail})`
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @route   PUT /api/auth/reset-credentials
// @access  Private (Admin Only)
router.put('/reset-credentials', protect, authorize('admin'), async (req, res) => {
  const { newLoginId, newPassword, otp } = req.body;
  try {
    if (!otp) return res.status(400).json({ success: false, message: 'Verification code (OTP) is required.' });

    // FIX #3: Read from persistent store
    const storedOtp = ttlStore.get('otp', req.user.loginId);
    if (!storedOtp) {
      return res.status(400).json({ success: false, message: 'Verification code expired or not found. Please request a new code.' });
    }
    if (storedOtp !== otp.trim()) {
      return res.status(400).json({ success: false, message: 'Incorrect verification code. Please try again.' });
    }
    ttlStore.del('otp', req.user.loginId); // one-time use

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ success: false, message: 'Admin user not found' });

    if (newLoginId) {
      const existing = await User.findOne({ loginId: newLoginId });
      if (existing && existing._id.toString() !== user._id.toString()) {
        return res.status(400).json({ success: false, message: 'Username already in use.' });
      }
      user.loginId = newLoginId;
    }
    if (newPassword) user.password = newPassword;
    await user.save();
    res.json({ success: true, message: 'Admin credentials successfully updated.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
