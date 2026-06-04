const mongoose = require('mongoose');

const FeeSchema = new mongoose.Schema({
  receiptNo: {
    type: String,
    required: true,
    unique: true
  },
  studentId: {
    type: String,
    required: true,
    ref: 'Student'
  },
  amount: {
    type: Number,
    required: true
  },
  date: {
    type: Date,
    default: Date.now
  },
  method: {
    type: String,
    required: true,
    enum: ['Cash', 'UPI', 'Bank Transfer', 'Card', 'Online', 'Cheque']
  },
  reference: {
    type: String
  },
  notes: {
    type: String
  },
  academicYear: {
    type: String,
    required: true
  }
});

module.exports = mongoose.model('Fee', FeeSchema);
