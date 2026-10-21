const express = require('express');
const router = express.Router();
const Attendance = require('../models/Attendance');
const Student = require('../models/Student');
const { protect, authorize } = require('../middleware/auth');

// @route   POST /api/attendance
// @desc    Record or update bulk student attendance for a date/class/section
// @access  Private (Admin Only)
router.post('/', protect, authorize('admin'), async (req, res) => {
  const { date, className, section, records } = req.body; // records: Array of { studentId, status }

  try {
    const formattedDate = new Date(date);
    formattedDate.setHours(0, 0, 0, 0); // Normalize date to start of day

    const bulkOperations = records.map(rec => ({
      updateOne: {
        filter: { studentId: rec.studentId, date: formattedDate },
        update: {
          studentId: rec.studentId,
          date: formattedDate,
          status: rec.status,
          className,
          section
        },
        upsert: true
      }
    }));

    await Attendance.bulkWrite(bulkOperations);

    res.json({ success: true, message: 'Attendance records updated successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @route   GET /api/attendance/class
// @desc    Get attendance sheet for a class/section/date
// @access  Private (Admin Only)
router.get('/class', protect, authorize('admin'), async (req, res) => {
  const { date, className, section } = req.query;

  try {
    const formattedDate = new Date(date);
    formattedDate.setHours(0, 0, 0, 0);

    const sheet = await Attendance.find({
      className,
      section,
      date: formattedDate
    });

    res.json({ success: true, data: sheet });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @route   GET /api/attendance/student/:studentId
// @desc    Get attendance logs for a student
// @access  Private (Admin & Student Owner)
router.get('/student/:studentId', protect, async (req, res) => {
  try {
    // Role check: Students can only view their own attendance logs
    if (req.user.role === 'student') {
      const student = await Student.findOne({ loginId: req.user.loginId });
      if (!student || student.id !== req.params.studentId) {
        return res.status(403).json({ success: false, message: 'Unauthorized access to student logs' });
      }
    }

    const logs = await Attendance.find({ studentId: req.params.studentId }).sort({ date: -1 });
    res.json({ success: true, data: logs });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
