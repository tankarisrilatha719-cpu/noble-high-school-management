const mongoose = require('mongoose');

const StudentSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  loginId: {
    type: String,
    required: true,
    unique: true
  },
  password: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: [true, 'Please provide student name'],
    trim: true
  },
  className: {
    type: String,
    required: true
  },
  section: {
    type: String,
    required: true
  },
  rollNo: {
    type: String,
    required: true
  },
  fatherName: {
    type: String,
    required: true
  },
  phone: {
    type: String,
    required: true
  },
  emergencyPhone: {
    type: String
  },
  aadhaar: {
    type: String,
    required: true
  },
  apaar: {
    type: String
  },
  address: {
    type: String
  },
  academicYear: {
    type: String,
    default: '2026-2027'
  },
  photo: {
    type: String // Stores base64 data url or image asset URL
  },
  totalFee: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['active', 'archived'],
    default: 'active'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Student', StudentSchema);
