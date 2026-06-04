const mongoose = require('mongoose');

const AttendanceSchema = new mongoose.Schema({
  studentId: {
    type: String,
    required: true,
    ref: 'Student'
  },
  date: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ['present', 'absent'],
    required: true
  },
  className: {
    type: String,
    required: true
  },
  section: {
    type: String,
    required: true
  }
});

// Enforce unique attendance entry per student per date
AttendanceSchema.index({ studentId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('Attendance', AttendanceSchema);
