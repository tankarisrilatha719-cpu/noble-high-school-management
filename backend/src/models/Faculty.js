const mongoose = require('mongoose');

const FacultySchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true
  },
  designation: {
    type: String,
    required: true
  },
  qualification: {
    type: String,
    required: true
  },
  experience: {
    type: String
  },
  phone: {
    type: String
  },
  email: {
    type: String
  },
  photo: {
    type: String // Base64 data URL
  },
  orderIndex: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Faculty', FacultySchema);
