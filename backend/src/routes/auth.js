const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const svgCaptcha = require('svg-captcha');
const User = require('../models/User');
const Student = require('../models/Student');
const { protect, authorize } = require('../middleware/auth');
const { sendOTPEmail } = require('../utils/emailService');
// Memory stores for CAPTCHA and OTP
const captchaStore = new Map();
const otpStore = new Map();
// Helper to generate unique identifiers
const generateId = () => Math.random().toString(36).substring(2, 15);
// Generate JWT token helper
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'supersecretjwtkeychangeinproduction', {
    expiresIn: process.env.JWT_EXPIRE || '24h'
  });
};
// @route   GET /api/auth/captcha
// @desc    Generate a dynamic SVG CAPTCHA (Government website style, secure path representation)
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
  
  // Store the CAPTCHA with 5 minutes expiration
  captchaStore.set(captchaId, {
    text: captcha.text,
    expires: Date.now() + 5 * 60 * 1000
  });
  res.json({
    success: true,
    captchaId,
    image: `data:image/svg+xml;base64,${Buffer.from(captcha.data).toString('base64')}`
  });
});
// @route   POST /api/auth/register-admin
// @desc    Register a new admin (Setup utility)
// @access  Public (Should be locked down in production)
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
      user: {
        id: user._id,
        loginId: user.loginId,
        role: user.role,
        email: user.email
      }
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
    // Check if user exists
    const user = await User.findOne({ loginId });
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    // Role-based flow
    if (user.role === 'admin') {
      // 1. CAPTCHA Check
      if (!captchaId || !captcha) {
        return res.status(400).json({ success: false, message: 'Verification Code (CAPTCHA) is required for admin access' });
      }
      
      const storedCaptcha = captchaStore.get(captchaId);
      if (!storedCaptcha || storedCaptcha.expires < Date.now()) {
        return res.status(400).json({ success: false, message: 'CAPTCHA code expired. Please refresh verification code.' });
      }
      
      if (storedCaptcha.text.toLowerCase() !== captcha.trim().toLowerCase()) {
        return res.status(400).json({ success: false, message: 'Incorrect Verification Code. Please try again.' });
      }
      
      // Expire captcha code so it cannot be reused
      captchaStore.delete(captchaId);
      // 2. Generate 6-digit OTP code
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      
      // Store OTP code with 5 mins validity
      otpStore.set(loginId, {
        otp,
        expires: Date.now() + 5 * 60 * 1000
      });
      // Send Email to Registered Admin Email Address (fallback to EMAIL_USER)
      const adminEmail = user.email || process.env.EMAIL_USER;
      console.log(`\n======================================================`);
      console.log(`[DEVELOPER OTP BYPASS] Generated OTP for Admin: ${otp}`);
      console.log(`======================================================\n`);
      try {
        await sendOTPEmail(adminEmail, otp);
      } catch (emailErr) {
        console.error('[EMAIL ERROR] Failed to send OTP email via SMTP:', emailErr.message);
        console.log('[DEVELOPER BYPASS] You can successfully log in using the generated OTP shown above in the terminal.');
      }
      // Return a 2FA requirement payload (masking the email address slightly for privacy)
      const maskedEmail = adminEmail.replace(/(.{3})(.*)(@.*)/, '$1***$3');
      return res.json({
        success: true,
        requireOTP: true,
        loginId,
        message: `A verification code (OTP) has been sent to your registered email (${maskedEmail})`
      });
    }
    // Student Login flow (direct login without CAPTCHA / 2FA)
    const token = generateToken(user._id);
    const studentDetails = await Student.findOne({ loginId: user.loginId });
    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        loginId: user.loginId,
        role: user.role,
        studentInfo: studentDetails
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
// @route   POST /api/auth/verify-otp
// @desc    Verify OTP code for admin and issue session token
// @access  Public
router.post('/verify-otp', async (req, res) => {
  const { loginId, otp } = req.body;
  try {
    if (!loginId || !otp) {
      return res.status(400).json({ success: false, message: 'Username and verification code are required.' });
    }
    const storedOtpData = otpStore.get(loginId);
    if (!storedOtpData || storedOtpData.expires < Date.now()) {
      return res.status(400).json({ success: false, message: 'Verification code expired or not found. Please log in again.' });
    }
    if (storedOtpData.otp !== otp.trim()) {
      return res.status(400).json({ success: false, message: 'Incorrect verification code. Please try again.' });
    }
    // OTP matches! Clear the stored OTP so it cannot be reused
    otpStore.delete(loginId);
    // Look up the admin user
    const user = await User.findOne({ loginId });
    if (!user) {
      return res.status(404).json({ success: false, message: 'Admin user not found' });
    }
    const token = generateToken(user._id);
    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        loginId: user.loginId,
        role: user.role
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
// @route   GET /api/auth/me
// @desc    Get current logged in user details
// @access  Private
router.get('/me', protect, async (req, res) => {
  try {
    let studentDetails = null;
    if (req.user.role === 'student') {
      studentDetails = await Student.findOne({ loginId: req.user.loginId });
    }
    res.json({
      success: true,
      user: {
        id: req.user._id,
        loginId: req.user.loginId,
        role: req.user.role,
        studentInfo: studentDetails
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
// @route   POST /api/auth/send-otp-monolith
// @desc    Send OTP for self-contained HTML monolith (called via fetch)
// @access  Public
router.post('/send-otp-monolith', async (req, res) => {
  const { otp } = req.body;
  try {
    const adminEmail = process.env.EMAIL_USER;
    if (!otp) {
      return res.status(400).json({ success: false, message: 'OTP is required' });
    }
    await sendOTPEmail(adminEmail, otp);
    res.json({ success: true, message: 'OTP sent successfully to registered admin email' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
// @route   POST /api/auth/verify-credentials
// @desc    Verify credentials from the frontend monolith
// @access  Public
router.post('/verify-credentials', async (req, res) => {
  const { loginId, password, role } = req.body;
  try {
    const escapedLoginId = (loginId || '').replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const user = await User.findOne({ loginId: { $regex: new RegExp('^' + escapedLoginId + '$', 'i') } });
    if (!user) {
      return res.json({ success: false, message: 'Invalid username' });
    }
    if (role && user.role !== role) {
      return res.json({ success: false, message: 'Role mismatch' });
    }
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.json({ success: false, message: 'Invalid password' });
    }
    let studentInfo = null;
    if (user.role === 'student') {
      studentInfo = await Student.findOne({ loginId: { $regex: new RegExp('^' + escapedLoginId + '$', 'i') } });
    }
    res.json({ success: true, role: user.role, studentInfo });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
// @route   POST /api/auth/reset-credentials-monolith
// @desc    Reset admin credentials from the frontend monolith (authenticates using current pwd)
// @access  Public
router.post('/reset-credentials-monolith', async (req, res) => {
  const { currentLoginId, currentPassword, newLoginId, newPassword } = req.body;
  try {
    const user = await User.findOne({ loginId: currentLoginId, role: 'admin' });
    if (!user) {
      return res.json({ success: false, message: 'Invalid current credentials' });
    }
    const isMatch = await user.matchPassword(currentPassword);
    if (!isMatch) {
      return res.json({ success: false, message: 'Invalid current credentials' });
    }
    if (newLoginId) {
      // Ensure unique username
      const existingUser = await User.findOne({ loginId: newLoginId });
      if (existingUser && existingUser._id.toString() !== user._id.toString()) {
        return res.json({ success: false, message: 'New username already in use' });
      }
      user.loginId = newLoginId;
    }
    if (newPassword) {
      user.password = newPassword; // Automatically hashed on save
    }
    await user.save();
    res.json({ success: true, message: 'Admin credentials successfully updated in backend.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @route   POST /api/auth/request-otp-action
// @desc    Request an OTP for sensitive actions (Reset Credentials, Update Academic Year)
// @access  Private (Admin Only)
router.post('/request-otp-action', protect, authorize('admin'), async (req, res) => {
  try {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Store OTP code with 5 mins validity
    otpStore.set(req.user.loginId, {
      otp,
      expires: Date.now() + 5 * 60 * 1000
    });
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
    if (!otp) {
      return res.status(400).json({ success: false, message: 'Verification code (OTP) is required.' });
    }
    const storedOtpData = otpStore.get(req.user.loginId);
    if (!storedOtpData || storedOtpData.expires < Date.now()) {
      return res.status(400).json({ success: false, message: 'Verification code expired or not found. Please request a new code.' });
    }
    if (storedOtpData.otp !== otp.trim()) {
      return res.status(400).json({ success: false, message: 'Incorrect verification code. Please try again.' });
    }
    // OTP matches! Clear it so it cannot be reused
    otpStore.delete(req.user.loginId);
    // Update the admin user
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Admin user not found' });
    }
    if (newLoginId) {
      // Ensure unique
      const existingUser = await User.findOne({ loginId: newLoginId });
      if (existingUser && existingUser._id.toString() !== user._id.toString()) {
        return res.status(400).json({ success: false, message: 'Username already in use.' });
      }
      user.loginId = newLoginId;
    }
    if (newPassword) {
      user.password = newPassword;
    }
    await user.save();
    res.json({
      success: true,
      message: 'Admin credentials successfully updated.'
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
router.otpStore = otpStore;
module.exports = router;