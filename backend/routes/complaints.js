const express = require('express');
const router = express.Router();
const Complaint = require('../models/Complaint');
const { protect, authorize } = require('../middleware/auth');

// @route   POST /api/complaints
// @desc    Submit a new complaint (Public or authenticated student)
// @access  Public
router.post('/', async (req, res) => {
  const { id, studentId, visitorName, visitorPhone, subject, description } = req.body;

  try {
    const complaint = await Complaint.create({
      id,
      studentId,
      visitorName,
      visitorPhone,
      subject,
      description
    });
    res.status(201).json({ success: true, data: complaint });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @route   GET /api/complaints
// @desc    Get all complaints
// @access  Private (Admin Only)
router.get('/', protect, authorize('admin'), async (req, res) => {
  try {
    const complaints = await Complaint.find().sort({ date: -1 });
    res.json({ success: true, data: complaints });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @route   PUT /api/complaints/:id/resolve
// @desc    Update complaint status and response
// @access  Private (Admin Only)
router.put('/:id/resolve', protect, authorize('admin'), async (req, res) => {
  const { response } = req.body;

  try {
    const complaint = await Complaint.findOneAndUpdate(
      { id: req.params.id },
      { status: 'resolved', response },
      { new: true }
    );
    if (!complaint) {
      return res.status(404).json({ success: false, message: 'Complaint not found' });
    }
    res.json({ success: true, data: complaint });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
