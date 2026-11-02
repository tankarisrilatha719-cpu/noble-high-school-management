const express = require('express');
const router = express.Router();
const Notification = require('../models/Notification');
const Student = require('../models/Student');
const Attendance = require('../models/Attendance');
const { protect, authorize } = require('../middleware/auth');

// @route   POST /api/notifications/bulk-absent
// @desc    Identify absent students for class/section/date and send parent SMS
// @access  Private (Admin Only)
router.post('/bulk-absent', protect, authorize('admin'), async (req, res) => {
  const { date, className, section } = req.body;

  try {
    const formattedDate = new Date(date);
    formattedDate.setHours(0, 0, 0, 0);

    // 1. Fetch all absent records for this class/section/date
    const absentRecords = await Attendance.find({
      className,
      section,
      date: formattedDate,
      status: 'absent'
    });

    if (!absentRecords.length) {
      return res.json({
        success: true,
        message: 'No absent students found on this date.',
        sentCount: 0,
        notifications: []
      });
    }

    // 2. Generate and trigger notifications for each absent student
    const notificationsToCreate = [];
    
    for (const record of absentRecords) {
      // Find student details to get phone and name
      const student = await Student.findOne({ id: record.studentId });
      if (student) {
        const messageText = `Dear Parent, your child ${student.name} (ID: ${student.id}) was marked ABSENT today (${date}) at Noble High School. Please contact the administration if this is an error.`;
        
        // Mock SMS API Trigger
        // In production: await smsGateway.send(student.phone, messageText)
        console.log(`[SMS Gateway Triggered] To: ${student.phone} | Msg: ${messageText}`);
        
        notificationsToCreate.push({
          studentId: student.id,
          studentName: student.name,
          parentPhone: student.phone,
          message: messageText,
          status: 'sent',
          triggerType: 'absent-sms'
        });
      }
    }

    // Save logs to DB
    const createdLogs = await Notification.insertMany(notificationsToCreate);

    res.status(201).json({
      success: true,
      message: `SMS notifications triggered for ${createdLogs.length} absent students.`,
      sentCount: createdLogs.length,
      notifications: createdLogs
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @route   GET /api/notifications
// @desc    Get sent notifications logs
// @access  Private (Admin Only)
router.get('/', protect, authorize('admin'), async (req, res) => {
  try {
    const logs = await Notification.find().sort({ date: -1 });
    res.json({ success: true, count: logs.length, data: logs });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
