const express = require('express');
const router = express.Router();
const Exam = require('../models/Exam');
const { protect, authorize } = require('../middleware/auth');

// @route   GET /api/exams
// @desc    Get all exams (Admins get all, students get published only)
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    let query = {};
    if (req.user.role === 'student') {
      query.published = true;
    }
    const exams = await Exam.find(query).sort({ createdAt: -1 });
    res.json({ success: true, data: exams });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @route   POST /api/exams
// @desc    Create an exam schedule
// @access  Private (Admin Only)
router.post('/', protect, authorize('admin'), async (req, res) => {
  const { id, name, className, htInstructions, days, academicYear } = req.body;

  try {
    const exam = await Exam.create({
      id,
      name,
      className,
      htInstructions,
      days,
      academicYear
    });
    res.status(201).json({ success: true, data: exam });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @route   PUT /api/exams/:id
// @desc    Update exam timetable details
// @access  Private (Admin Only)
router.put('/:id', protect, authorize('admin'), async (req, res) => {
  try {
    const exam = await Exam.findOneAndUpdate({ id: req.params.id }, req.body, { new: true });
    if (!exam) {
      return res.status(404).json({ success: false, message: 'Exam timetable not found' });
    }
    res.json({ success: true, data: exam });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @route   DELETE /api/exams/:id
// @desc    Remove exam timetable
// @access  Private (Admin Only)
router.delete('/:id', protect, authorize('admin'), async (req, res) => {
  try {
    const exam = await Exam.findOneAndDelete({ id: req.params.id });
    if (!exam) {
      return res.status(404).json({ success: false, message: 'Exam timetable not found' });
    }
    res.json({ success: true, message: 'Exam timetable deleted successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
