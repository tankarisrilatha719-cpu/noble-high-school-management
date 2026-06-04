const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
  studentId: {
    type: String,
    required: true,
    ref: 'Student'
  },
  studentName: {
    type: String,
    required: true
  },
  parentPhone: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['sent', 'failed'],
    default: 'sent'
  },
  triggerType: {
    type: String,
    default: 'absent-sms'
  },
  date: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Notification', NotificationSchema);
