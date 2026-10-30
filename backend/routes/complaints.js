const express = require('express');
const router = express.Router();
const Complaint = require('../models/Complaint');
const { protect, authorize } = require('../middleware/auth');

// Public complaints are submitted through POST /api/sync/public/complaint.

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
