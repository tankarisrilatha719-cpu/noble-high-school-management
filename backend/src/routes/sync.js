const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

// Import Mongoose Models (for when MongoDB is connected)
const Student = require('../models/Student');
const User = require('../models/User');
const Fee = require('../models/Fee');
const Attendance = require('../models/Attendance');
const Exam = require('../models/Exam');
const Faculty = require('../models/Faculty');
const Complaint = require('../models/Complaint');
const Settings = require('../models/Settings');
const Notification = require('../models/Notification');

// Path to fallback database
const DB_FILE_PATH = path.resolve(__dirname, '../../db-fallback.json');

// General Key-Value Schema for full sync backup inside MongoDB
const FallbackStoreSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  value: { type: mongoose.Schema.Types.Mixed, required: true }
}, { timestamps: true });

let FallbackStore;
try {
  FallbackStore = mongoose.model('FallbackStore');
} catch (e) {
  FallbackStore = mongoose.model('FallbackStore', FallbackStoreSchema);
}

// @route  GET /api/sync/get-all
// @desc   Get all database contents (either from MongoDB FallbackStore or local json file)
router.get('/get-all', async (req, res) => {
  try {
    if (global.useMongooseMock) {
      // JSON File fallback is active
      if (!fs.existsSync(DB_FILE_PATH)) {
        return res.json({ success: true, data: {} });
      }
      const raw = fs.readFileSync(DB_FILE_PATH, 'utf8');
      return res.json({ success: true, data: JSON.parse(raw || '{}') });
    } else {
      // MongoDB is active
      const stores = await FallbackStore.find();
      const data = {};
      stores.forEach(s => {
        data[s.key] = s.value;
      });
      return res.json({ success: true, data });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @route  POST /api/sync/set
// @desc   Save/sync a single collection
router.post('/set', async (req, res) => {
  const { key, value } = req.body;
  if (!key) {
    return res.status(400).json({ success: false, message: 'Key is required' });
  }
  
  try {
    // 1. Always write to local JSON file for extra safety / local mode
    let localDb = {};
    if (fs.existsSync(DB_FILE_PATH)) {
      try {
        localDb = JSON.parse(fs.readFileSync(DB_FILE_PATH, 'utf8') || '{}');
      } catch (e) {}
    }
    localDb[key] = value;
    fs.writeFileSync(DB_FILE_PATH, JSON.stringify(localDb, null, 2), 'utf8');
    
    // 2. If MongoDB is active, save to FallbackStore AND individual collection
    if (true) {
      // Save key-value to MongoDB FallbackStore
      await FallbackStore.findOneAndUpdate(
        { key },
        { key, value },
        { upsert: true, new: true }
      );
      
      // Perform structured Sync to standard collections so backend APIs remain functional
      if (key === 'students') {
        // Clear and rebuild Student collections and User credentials
        await Student.deleteMany({ status: 'active' });
        
        // Find existing admin users to preserve them
        const adminUsers = await User.find({ role: 'admin' });
        await User.deleteMany({});
        
        // Re-insert admin users
        for (const admin of adminUsers) {
          await User.create({ loginId: admin.loginId, password: admin.password, role: 'admin', email: admin.email });
        }
        
        // Loop and create new students & student users
        if (Array.isArray(value)) {
          for (const s of value) {
            await Student.create({
              id: s.id,
              loginId: s.loginId,
              password: s.password,
              name: s.name,
              className: s.className,
              section: s.section,
              rollNo: s.rollNo,
              fatherName: s.fatherName,
              phone: s.phone,
              emergencyPhone: s.emergencyPhone,
              aadhaar: s.aadhaar || '000000000000',
              apaar: s.apaar,
              address: s.address,
              academicYear: s.academicYear,
              photo: s.photo,
              totalFee: s.totalFee || 0,
              status: s.status || 'active'
            });
            
            // Create user login access
            await User.create({
              loginId: s.loginId,
              password: s.password,
              role: 'student'
            });
          }
        }
      } else if (key === 'archived') {
        await Student.deleteMany({ status: 'archived' });
        if (Array.isArray(value)) {
          for (const s of value) {
            await Student.create({
              id: s.id,
              loginId: s.loginId,
              password: s.password,
              name: s.name,
              className: s.className,
              section: s.section,
              rollNo: s.rollNo,
              fatherName: s.fatherName,
              phone: s.phone,
              emergencyPhone: s.emergencyPhone,
              aadhaar: s.aadhaar || '000000000000',
              apaar: s.apaar,
              address: s.address,
              academicYear: s.academicYear,
              photo: s.photo,
              totalFee: s.totalFee || 0,
              status: 'archived'
            });
          }
        }
      } else if (key === 'fees') {
        await Fee.deleteMany({});
        if (Array.isArray(value)) {
          for (const f of value) {
            await Fee.create({
              id: f.id,
              studentId: f.studentId,
              studentName: f.studentName,
              className: f.className,
              section: f.section,
              amountPaid: f.amountPaid,
              paymentMode: f.paymentMode,
              paymentDate: f.paymentDate,
              receiptNo: f.receiptNo,
              paymentTime: f.paymentTime
            });
          }
        }
      } else if (key === 'faculty') {
        await Faculty.deleteMany({});
        if (Array.isArray(value)) {
          for (const f of value) {
            await Faculty.create({
              id: f.id,
              name: f.name,
              designation: f.designation,
              qualification: f.qualification,
              phone: f.phone,
              email: f.email,
              experience: f.experience,
              photo: f.photo
            });
          }
        }
      } else if (key === 'exams') {
        await Exam.deleteMany({});
        if (Array.isArray(value)) {
          for (const ex of value) {
            await Exam.create({
              id: ex.id,
              className: ex.className,
              examName: ex.examName,
              startDate: ex.startDate,
              endDate: ex.endDate,
              subjects: ex.subjects
            });
          }
        }
      } else if (key === 'complaints') {
        await Complaint.deleteMany({});
        if (Array.isArray(value)) {
          for (const c of value) {
            await Complaint.create({
              id: c.id,
              studentId: c.studentId,
              studentName: c.studentName,
              className: c.className,
              section: c.section,
              title: c.title,
              description: c.description,
              dateSubmitted: c.dateSubmitted,
              status: c.status
            });
          }
        }
      } else if (key === 'notifications') {
        await Notification.deleteMany({});
        if (Array.isArray(value)) {
          for (const n of value) {
            await Notification.create({
              id: n.id,
              title: n.title,
              message: n.message,
              target: n.target,
              dateSent: n.dateSent,
              readBy: n.readBy
            });
          }
        }
      } else if (key === 'system') {
        if (value && typeof value === 'object') {
          await Settings.findOneAndUpdate(
            {},
            { academicYear: value.academicYear },
            { upsert: true }
          );
        }
      }
    }
    
    res.json({ success: true, message: `Collection ${key} synced successfully` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
