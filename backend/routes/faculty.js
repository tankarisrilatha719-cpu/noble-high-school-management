const express = require('express');
const router = express.Router();
const Faculty = require('../models/Faculty');
const { protect, authorize } = require('../middleware/auth');

// @route   GET /api/faculty
// @desc    Get all faculty members ordered by orderIndex
// @access  Public
router.get('/', async (req, res) => {
  try {
    const faculty = await Faculty.find().sort({ orderIndex: 1 });
    res.json({ success: true, data: faculty });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @route   POST /api/faculty
// @desc    Add a new faculty member
// @access  Private (Admin Only)
router.post('/', protect, authorize('admin'), async (req, res) => {
  const { id, name, designation, qualification, experience, phone, email, photo } = req.body;

  try {
    const count = await Faculty.countDocuments();
    const faculty = await Faculty.create({
      id,
      name,
      designation,
      qualification,
      experience,
      phone,
      email,
      photo,
      orderIndex: count
    });
    res.status(201).json({ success: true, data: faculty });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @route   PUT /api/faculty/:id
// @desc    Update a faculty member details
// @access  Private (Admin Only)
router.put('/:id', protect, authorize('admin'), async (req, res) => {
  try {
    const faculty = await Faculty.findOneAndUpdate({ id: req.params.id }, req.body, { new: true });
    if (!faculty) {
      return res.status(404).json({ success: false, message: 'Faculty member not found' });
    }
    res.json({ success: true, data: faculty });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @route   DELETE /api/faculty/:id
// @desc    Remove a faculty member
// @access  Private (Admin Only)
router.delete('/:id', protect, authorize('admin'), async (req, res) => {
  try {
    const faculty = await Faculty.findOneAndDelete({ id: req.params.id });
    if (!faculty) {
      return res.status(404).json({ success: false, message: 'Faculty member not found' });
    }
    res.json({ success: true, message: 'Faculty member deleted successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
