const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
  // General announcement fields (client-side notifications)
  id: {
    type: String
  },
  recipient: {
    type: String
  },
  className: {
    type: String
  },
  section: {
    type: String
  },
  subject: {
    type: String
  },
  priority: {
    type: String
  },
  dateTime: {
    type: String
  },
  read: {
    type: [String],
    default: []
  },
  photo: {
    type: String // Stores base64 data url or image asset URL
  },

  // Automated SMS logs fields (made optional to allow both document types)
  studentId: {
    type: String,
    ref: 'Student'
  },
  studentName: {
    type: String
  },
  parentPhone: {
    type: String
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
