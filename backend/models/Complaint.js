const mongoose = require('mongoose');

const ComplaintSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true
  },
  studentId: {
    type: String,
    ref: 'Student' // Optional if submitted by a registered student
  },
  visitorName: {
    type: String // Optional for public submissions
  },
  visitorPhone: {
    type: String
  },
  subject: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'resolved'],
    default: 'pending'
  },
  response: {
    type: String
  },
  date: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Complaint', ComplaintSchema);
