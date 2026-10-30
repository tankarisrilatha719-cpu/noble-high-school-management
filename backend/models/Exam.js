const mongoose = require('mongoose');

const ExamDaySchema = new mongoose.Schema({
  date: {
    type: Date,
    required: true
  },
  subject: {
    type: String,
    required: true
  },
  time: {
    type: String,
    required: true
  }
});

const ExamSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true
  },
  className: {
    type: String,
    required: true
  },
  published: {
    type: Boolean,
    default: false
  },
  htInstructions: {
    type: String,
    default: 'Reach the exam hall by 9:00 AM. Bring this hall ticket and a black/blue pen. Mobile phones are NOT allowed.'
  },
  days: [ExamDaySchema],
  academicYear: {
    type: String,
    default: '2026-2027'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Exam', ExamSchema);
