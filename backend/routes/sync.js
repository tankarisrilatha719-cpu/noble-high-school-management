const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

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
const DB_FILE_PATH = path.resolve(__dirname, '../../database/db-fallback.json');

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


const { protect, optionalAuth, authorize } = require('../middleware/auth');

// Every key the app may store. Anything else (e.g. 'users', which shares the
// fallback JSON file with the auth models) is rejected.
const SYNC_KEYS = [
  'students', 'archived', 'fees', 'notifications', 'complaints', 'attendance',
  'holidays', 'leaves', 'exams', 'reports', 'hallTickets', 'admissions',
  'posters', 'gallery', 'activities', 'faculty', 'system'
];
// Keys anonymous visitors may read (home page sliders, gallery, faculty).
const PUBLIC_KEYS = ['posters', 'gallery', 'activities', 'faculty'];

async function readAll() {
  if (global.useMongooseMock) {
    if (!fs.existsSync(DB_FILE_PATH)) return {};
    const all = JSON.parse(fs.readFileSync(DB_FILE_PATH, 'utf8') || '{}');
    const data = {};
    SYNC_KEYS.forEach(k => { if (all[k] !== undefined) data[k] = all[k]; });
    return data;
  }
  const stores = await FallbackStore.find();
  const data = {};
  stores.forEach(s => { if (SYNC_KEYS.includes(s.key)) data[s.key] = s.value; });
  return data;
}

async function readKey(key, def) {
  const all = await readAll();
  return all[key] !== undefined ? all[key] : def;
}

// Persist one collection to the JSON file and, when MongoDB is connected, to
// the key-value store plus the structured collections the REST routes use.
async function writeKey(key, value) {
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
  if (!global.useMongooseMock) {
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
            dob: s.dob,
            joinDate: s.joinDate,
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
            dob: s.dob,
            joinDate: s.joinDate,
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
      await Notification.deleteMany({ triggerType: { $ne: 'absent-sms' } });
      if (Array.isArray(value)) {
        for (const n of value) {
          await Notification.create({
            id: n.id,
            recipient: n.recipient,
            className: n.className,
            section: n.section,
            studentId: n.studentId,
            subject: n.subject,
            message: n.message,
            priority: n.priority,
            dateTime: n.dateTime,
            read: n.read || [],
            photo: n.photo,
            triggerType: 'announcement'
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
  
}

// Read-modify-write operations are serialised so two parents submitting a
// form at the same moment cannot overwrite each other's record.
let writeQueue = Promise.resolve();
function withWriteLock(fn) {
  const run = writeQueue.then(fn, fn);
  writeQueue = run.catch(() => {});
  return run;
}

// ---- Role-based views -------------------------------------------------------

function publicView(data) {
  const out = {};
  PUBLIC_KEYS.forEach(k => { if (data[k] !== undefined) out[k] = data[k]; });
  const sys = data.system || {};
  out.system = { academicYear: sys.academicYear };
  return out;
}

function stripSecret(s) {
  if (!s) return s;
  const { password, ...rest } = s;
  return rest;
}

function studentView(data, studentId) {
  const out = publicView(data);
  const me = (data.students || []).find(s => s.id === studentId && s.status === 'active');
  if (!me) return out;
  const mine = r => r && r.studentId === me.id;
  const now = new Date();

  out.system = data.system || {};
  out.students = [stripSecret(me)];
  out.archived = [];
  out.admissions = [];
  out.hallTickets = (data.hallTickets || []).filter(mine);
  out.fees = (data.fees || []).filter(mine);
  out.leaves = (data.leaves || []).filter(mine);
  out.holidays = data.holidays || [];
  out.exams = (data.exams || []).filter(e => e.published && e.className === me.className);
  out.reports = (data.reports || []).filter(r => mine(r) && r.published && new Date(r.publishTime) <= now);
  out.complaints = (data.complaints || []).filter(c => c.stuId === me.id || c.stuId === me.loginId)
    .map(({ adminNotes, ...c }) => c);
  out.notifications = (data.notifications || []).filter(n =>
    n.recipient === 'all' ||
    (n.recipient === 'student' && n.studentId === me.id) ||
    (n.recipient === 'class' && n.className === me.className && (n.section === 'all' || n.section === me.section))
  ).map(n => ({ ...n, read: (n.read || []).filter(id => id === me.id) }));

  // Attendance keeps its calendar structure but only reveals whether this
  // student was absent.
  const att = data.attendance || {};
  const myAtt = {};
  Object.keys(att).forEach(date => {
    const day = att[date] || {};
    myAtt[date] = {};
    Object.keys(day).forEach(k => {
      const entry = day[k] || {};
      myAtt[date][k] = { absent: (entry.absent || []).filter(id => id === me.id), timestamp: entry.timestamp };
    });
  });
  out.attendance = myAtt;
  return out;
}

// @route  GET /api/sync/get-all
// @desc   Data visible to the caller: public content for visitors, the
//         student's own records for students, everything for admins.
router.get('/get-all', optionalAuth, async (req, res) => {
  try {
    const data = await readAll();
    let view;
    if (req.user && req.user.role === 'admin') view = data;
    else if (req.user && req.user.role === 'student') view = studentView(data, req.user.studentId);
    else view = publicView(data);
    res.json({ success: true, data: view });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Could not load data.' });
  }
});

// @route  POST /api/sync/set
// @desc   Replace one collection (admin only)
router.post('/set', protect, authorize('admin'), async (req, res) => {
  const { key, value } = req.body;
  if (!SYNC_KEYS.includes(key)) {
    return res.status(400).json({ success: false, message: 'Unknown collection' });
  }
  try {
    await withWriteLock(() => writeKey(key, value));
    res.json({ success: true, message: `Collection ${key} synced successfully` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ---- Public form submissions ------------------------------------------------

// In-memory rate limiter: at most `limit` requests per IP per window.
const hits = new Map();
function rateLimit(limit, windowMs) {
  return (req, res, next) => {
    const key = req.path + '|' + (req.ip || '');
    const now = Date.now();
    const recent = (hits.get(key) || []).filter(t => now - t < windowMs);
    if (recent.length >= limit) {
      return res.status(429).json({ success: false, message: 'Too many submissions. Please try again later or call the school office.' });
    }
    recent.push(now);
    hits.set(key, recent);
    next();
  };
}

// Trim, cap length, and strip angle brackets so submitted text can never
// carry markup into the admin screens.
function clean(v, max) {
  return String(v == null ? '' : v).replace(/[<>]/g, '').trim().slice(0, max);
}
const isPhone = p => /^\d{10}$/.test(p);
const isDate = d => /^\d{4}-\d{2}-\d{2}$/.test(d);

function nextId(prefix, list) {
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const used = list.filter(x => String(x.id || '').startsWith(`${prefix}-${stamp}-`)).length;
  return `${prefix}-${stamp}-${String(used + 1).padStart(3, '0')}`;
}

// @route  POST /api/sync/public/complaint
router.post('/public/complaint', rateLimit(5, 60 * 60 * 1000), async (req, res) => {
  const b = req.body || {};
  const stuName = clean(b.stuName, 100);
  const parName = clean(b.parName, 100);
  const stuId = clean(b.stuId, 40);
  const phone = clean(b.phone, 10);
  const details = clean(b.details, 2000);
  if (!stuName || !parName || !stuId || !phone || !details) {
    return res.status(400).json({ success: false, message: 'Please fill all required fields.' });
  }
  if (!isPhone(phone)) return res.status(400).json({ success: false, message: 'Phone must be 10 digits.' });

  try {
    const result = await withWriteLock(async () => {
      const students = await readKey('students', []);
      const matched = students.find(s => s.status === 'active' && (s.loginId === stuId || s.id === stuId));
      if (!matched) {
        return { error: 'The Student Login ID you entered does not match any registered student. Please check with the school for the correct Login ID.' };
      }
      const enteredName = stuName.toLowerCase();
      const realName = (matched.name || '').toLowerCase();
      if (realName && !realName.includes(enteredName) && !enteredName.includes(realName)) {
        return { error: 'The student name does not match our records for this Login ID. Please verify and try again.' };
      }
      const complaints = await readKey('complaints', []);
      const id = nextId('COMP', complaints);
      complaints.push({
        id, stuName, parName, stuId: matched.id, loginIdEntered: stuId, phone, details,
        date: new Date().toISOString(), status: 'Pending', adminNotes: ''
      });
      await writeKey('complaints', complaints);
      return { id };
    });
    if (result.error) return res.status(400).json({ success: false, message: result.error });
    res.json({ success: true, id: result.id });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Could not submit right now. Please call the school office.' });
  }
});

// @route  POST /api/sync/public/admission
router.post('/public/admission', rateLimit(5, 60 * 60 * 1000), async (req, res) => {
  const b = req.body || {};
  const rec = {
    stuName: clean(b.stuName, 100),
    dob: clean(b.dob, 10),
    fatherName: clean(b.fatherName, 100),
    motherName: clean(b.motherName, 100),
    phone1: clean(b.phone1, 10),
    phone2: clean(b.phone2, 10),
    classToJoin: clean(b.classToJoin, 20),
    prevSchool: clean(b.prevSchool, 300),
    address: clean(b.address, 500)
  };
  const CLASSES = ['Nursery', 'LKG', 'UKG', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];
  if (!rec.stuName || !rec.dob || !rec.fatherName || !rec.motherName || !rec.phone1 || !rec.classToJoin || !rec.address) {
    return res.status(400).json({ success: false, message: 'Please fill all required fields.' });
  }
  if (!isDate(rec.dob)) return res.status(400).json({ success: false, message: 'Please enter a valid date of birth.' });
  if (!isPhone(rec.phone1)) return res.status(400).json({ success: false, message: 'Phone number 1 must be exactly 10 digits.' });
  if (rec.phone2 && !isPhone(rec.phone2)) return res.status(400).json({ success: false, message: 'Phone number 2 must be exactly 10 digits.' });
  if (!CLASSES.includes(rec.classToJoin)) return res.status(400).json({ success: false, message: 'Please choose a class.' });

  try {
    const id = await withWriteLock(async () => {
      const admissions = await readKey('admissions', []);
      const ackNo = nextId('ADM', admissions);
      admissions.push({ id: ackNo, ...rec, submittedAt: new Date().toISOString(), status: 'Pending', adminNotes: '' });
      await writeKey('admissions', admissions);
      return ackNo;
    });
    res.json({ success: true, id });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Could not submit right now. Please call the school office.' });
  }
});

// ---- Student actions --------------------------------------------------------

// @route  POST /api/sync/student/leave
router.post('/student/leave', protect, authorize('student'), async (req, res) => {
  const fromDate = clean(req.body.fromDate, 10);
  const toDate = clean(req.body.toDate, 10);
  const reason = clean(req.body.reason, 500);
  if (!isDate(fromDate) || !isDate(toDate) || toDate < fromDate) {
    return res.status(400).json({ success: false, message: 'Please choose valid From and To dates.' });
  }
  try {
    const leave = await withWriteLock(async () => {
      const students = await readKey('students', []);
      const me = students.find(s => s.id === req.user.studentId && s.status === 'active');
      if (!me) return null;
      const leaves = await readKey('leaves', []);
      const rec = {
        id: 'LV' + Date.now(), studentId: me.id, studentName: me.name, className: me.className, section: me.section,
        fromDate, toDate, reason, appliedOn: new Date().toISOString().slice(0, 10), status: 'pending'
      };
      leaves.push(rec);
      await writeKey('leaves', leaves);
      return rec;
    });
    if (!leave) return res.status(403).json({ success: false, message: 'Your account is not active.' });
    res.json({ success: true, leave });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Could not submit leave right now.' });
  }
});

// @route  POST /api/sync/student/notifications/read
// @body   { ids: [notificationId, ...] }
router.post('/student/notifications/read', protect, authorize('student'), async (req, res) => {
  const ids = Array.isArray(req.body.ids) ? req.body.ids.map(String).slice(0, 500) : [];
  try {
    await withWriteLock(async () => {
      const notifs = await readKey('notifications', []);
      let changed = false;
      notifs.forEach(n => {
        if (ids.includes(n.id)) {
          n.read = n.read || [];
          if (!n.read.includes(req.user.studentId)) { n.read.push(req.user.studentId); changed = true; }
        }
      });
      if (changed) await writeKey('notifications', notifs);
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

module.exports = router;
module.exports.readKey = readKey;
module.exports.writeKey = writeKey;
module.exports.withWriteLock = withWriteLock;
