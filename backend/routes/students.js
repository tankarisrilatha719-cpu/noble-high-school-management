const express = require('express');
const router = express.Router();
const Student = require('../models/Student');
const User = require('../models/User');
const { protect, authorize } = require('../middleware/auth');
// @route   GET /api/students
// @desc    Get all active students (or filter by class/search)
// @access  Private (Admin Only)
router.get('/', protect, authorize('admin'), async (req, res) => {
  try {
    const { className, search } = req.query;
    let query = { status: 'active' };
    if (className) {
      query.className = className;
    }
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { id: { $regex: search, $options: 'i' } },
        { loginId: { $regex: search, $options: 'i' } }
      ];
    }
    const students = await Student.find(query).sort({ id: 1 });
    res.json({ success: true, count: students.length, data: students });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
// @route   POST /api/students
// @desc    Create a new student (and auto-provision User credentials)
// @access  Private (Admin Only)
router.post('/', protect, authorize('admin'), async (req, res) => {
  const {
    id,
    loginId,
    password,
    name,
    className,
    section,
    rollNo,
    fatherName,
    phone,
    emergencyPhone,
    aadhaar,
    apaar,
    address,
    academicYear,
    dob,
    joinDate,
    photo,
    totalFee
  } = req.body;
  try {
    // Check if student id or loginId already exists
    const existingStudent = await Student.findOne({ $or: [{ id }, { loginId }] });
    if (existingStudent) {
      return res.status(400).json({ success: false, message: 'Student ID or Login ID already exists' });
    }
    // 1. Create Student record
    const student = await Student.create({
      id,
      loginId,
      password,
      name,
      className,
      section,
      rollNo,
      fatherName,
      phone,
      emergencyPhone,
      aadhaar,
      apaar,
      address,
      academicYear,
      dob,
      joinDate,
      photo,
      totalFee
    });
    // 2. Create User account for student portals access
    await User.create({
      loginId,
      password,
      role: 'student'
    });
    res.status(201).json({ success: true, data: student });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
// @route   PUT /api/students/:id
// @desc    Update a student details
// @access  Private (Admin Only)
router.put('/:id', protect, authorize('admin'), async (req, res) => {
  try {
    let student = await Student.findOne({ id: req.params.id });
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }
    student = await Student.findOneAndUpdate({ id: req.params.id }, req.body, {
      new: true,
      runValidators: true
    });
    if (req.body.password) {
      const user = await User.findOne({ loginId: student.loginId });
      if (user) {
        user.password = req.body.password;
        await user.save();
      }
    }
    res.json({ success: true, data: student });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
// @route   DELETE /api/students/:id
// @desc    Delete/Archive a student and remove User credentials
// @access  Private (Admin Only)
router.delete('/:id', protect, authorize('admin'), async (req, res) => {
  try {
    const student = await Student.findOne({ id: req.params.id });
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }
    // Archive on database or delete
    await Student.findOneAndDelete({ id: req.params.id });
    await User.findOneAndDelete({ loginId: student.loginId });
    res.json({ success: true, message: 'Student deleted successfully and user access revoked.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
// @route   GET /api/students/profile
// @desc    Get current student's portal info (Role check ensures safety)
// @access  Private (Student Only)
router.get('/profile', protect, authorize('student'), async (req, res) => {
  try {
    const student = await Student.findOne({ loginId: req.user.loginId });
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student profile details not found' });
    }
    res.json({ success: true, data: student });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
// @route   GET /api/students/public-scan/:id
// @desc    Public scan lookup for ID/QR verification
// @access  Public
router.get('/public-scan/:id', async (req, res) => {
  try {
    const student = await Student.findOne({ id: req.params.id });
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student ID not registered or card invalid' });
    }
    res.json({ success: true, data: student });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
module.exports = router;