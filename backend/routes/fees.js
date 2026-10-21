const express = require('express');
const router = express.Router();
const Fee = require('../models/Fee');
const Student = require('../models/Student');
const { protect, authorize } = require('../middleware/auth');

// @route   GET /api/fees
// @desc    Get all fee transactions
// @access  Private (Admin Only)
router.get('/', protect, authorize('admin'), async (req, res) => {
  try {
    const fees = await Fee.find().sort({ date: -1 });
    res.json({ success: true, count: fees.length, data: fees });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @route   POST /api/fees
// @desc    Submit a new fee payment
// @access  Private (Admin Only)
router.post('/', protect, authorize('admin'), async (req, res) => {
  const { receiptNo, studentId, amount, method, reference, notes, academicYear } = req.body;

  try {
    // Verify student exists
    const student = await Student.findOne({ id: studentId });
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student ID not found' });
    }

    // Verify receipt unique
    const existingFee = await Fee.findOne({ receiptNo });
    if (existingFee) {
      return res.status(400).json({ success: false, message: 'Receipt number already exists' });
    }

    const fee = await Fee.create({
      receiptNo,
      studentId,
      amount,
      method,
      reference,
      notes,
      academicYear
    });

    res.status(201).json({ success: true, data: fee });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @route   GET /api/fees/student/:studentId
// @desc    Get all fee payments for a specific student
// @access  Private (Admin & Student Owner)
router.get('/student/:studentId', protect, async (req, res) => {
  try {
    // If student logged in, ensure they can only access their own logs
    if (req.user.role === 'student') {
      const student = await Student.findOne({ loginId: req.user.loginId });
      if (!student || student.id !== req.params.studentId) {
        return res.status(403).json({ success: false, message: 'Unauthorized: Cannot access other student fees logs' });
      }
    }

    const fees = await Fee.find({ studentId: req.params.studentId }).sort({ date: -1 });
    res.json({ success: true, count: fees.length, data: fees });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @route   GET /api/fees/public-info/:studentId
// @desc    Get public fee status for chatbot (no auth required)
// @access  Public
router.get('/public-info/:studentId', async (req, res) => {
  try {
    const student = await Student.findOne({ id: req.params.studentId });
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student ID not found' });
    }
    const fees = await Fee.find({ studentId: req.params.studentId }).sort({ date: -1 });
    res.json({
      success: true,
      data: {
        student: {
          _id: student._id,
          id: student.id,
          name: student.name,
          className: student.className,
          section: student.section,
          totalFee: student.totalFee
        },
        payments: fees
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
