const express = require('express');
const router = express.Router();
const Student = require('../models/Student');
const User = require('../models/User');
const { protect, authorize } = require('../middleware/auth');
const { readKey } = require('./sync');
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
// @desc    Target of the QR code printed on ID cards. Confirms the card is
//          genuine and shows only what is printed on the card itself.
// @access  Public
router.get('/public-scan/:id', async (req, res) => {
  const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  try {
    const students = await readKey('students', []);
    const s = students.find(x => x.id === req.params.id && x.status === 'active');
    const body = s
      ? `<h1>ID card verified</h1><p class="ok">This is a current student of Noble High School.</p>
         <dl><dt>Name</dt><dd>${esc(s.name)}</dd><dt>Student ID</dt><dd>${esc(s.id)}</dd>
         <dt>Class</dt><dd>${esc(s.className)} &ndash; ${esc(s.section)}</dd><dt>Academic year</dt><dd>${esc(s.academicYear)}</dd></dl>`
      : `<h1>Card not recognised</h1><p class="bad">This ID is not registered as a current student. Please contact the school office: +91 98484 24618.</p>`;
    res.status(s ? 200 : 404).type('html').send(`<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>ID Verification | Noble High School</title>
<style>body{font-family:system-ui,sans-serif;max-width:420px;margin:40px auto;padding:0 16px;color:#1a2535}
h1{color:#0f2447;font-size:1.4rem}.ok{color:#1a7a4a;font-weight:600}.bad{color:#c0321a;font-weight:600}
dl{display:grid;grid-template-columns:auto 1fr;gap:8px 16px}dt{color:#5a6a82}dd{margin:0;font-weight:600}</style>
</head><body><p><strong>Noble High School</strong>, Kandukur</p>${body}</body></html>`);
  } catch (err) {
    res.status(500).send('Verification is unavailable right now.');
  }
});
module.exports = router;
