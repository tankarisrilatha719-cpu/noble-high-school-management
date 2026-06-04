const express = require('express');
const router = express.Router();
const Settings = require('../models/Settings');
const { protect, authorize } = require('../middleware/auth');

// @route   GET /api/settings
// @desc    Get system settings (Auto-provisions a default config if empty)
// @access  Public
router.get('/', async (req, res) => {
  try {
    let settings = await Settings.findOne();
    if (!settings) {
      settings = await Settings.create({});
    }
    res.json({ success: true, data: settings });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @route   PUT /api/settings
// @desc    Update system settings
// @access  Private (Admin Only)
router.put('/', protect, authorize('admin'), async (req, res) => {
  try {
    let settings = await Settings.findOne();
    if (!settings) {
      settings = await Settings.create(req.body);
    } else {
      settings = await Settings.findOneAndUpdate({}, req.body, { new: true });
    }
    res.json({ success: true, data: settings });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @route   PUT /api/settings/update-academic-year
// @desc    Update system settings' academic year (requires OTP verification)
// @access  Private (Admin Only)
router.put('/update-academic-year', protect, authorize('admin'), async (req, res) => {
  const { academicYear, otp } = req.body;

  try {
    if (!otp) {
      return res.status(400).json({ success: false, message: 'Verification code (OTP) is required.' });
    }

    const authRoutes = require('./auth');
    const otpStore = authRoutes.otpStore;

    const storedOtpData = otpStore.get(req.user.loginId);
    if (!storedOtpData || storedOtpData.expires < Date.now()) {
      return res.status(400).json({ success: false, message: 'Verification code expired or not found. Please request a new code.' });
    }

    if (storedOtpData.otp !== otp.trim()) {
      return res.status(400).json({ success: false, message: 'Incorrect verification code. Please try again.' });
    }

    // OTP matches! Clear it so it cannot be reused
    otpStore.delete(req.user.loginId);

    let settings = await Settings.findOne();
    if (!settings) {
      settings = await Settings.create({ academicYear });
    } else {
      settings = await Settings.findOneAndUpdate({}, { academicYear }, { new: true });
    }

    res.json({
      success: true,
      message: 'Academic Year successfully updated.',
      data: settings
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
