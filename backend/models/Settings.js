const mongoose = require('mongoose');

const SettingsSchema = new mongoose.Schema({
  schoolName: {
    type: String,
    default: 'Noble High School'
  },
  address: {
    type: String,
    default: "Kandukur 'X' Road, Kandukur, Rangareddy, Telangana"
  },
  phone: {
    type: String,
    default: '+91 98484 24618'
  },
  academicYear: {
    type: String,
    default: '2026-2027'
  },
  logo: {
    type: String // Base64 data URL
  },
  principalSignature: {
    type: String // Base64 data URL
  },
  showPrincipalSignature: {
    type: Boolean,
    default: false
  }
});

module.exports = mongoose.model('Settings', SettingsSchema);
