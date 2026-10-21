const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');

const app = express();

// Connect to MongoDB (with fallback to local JSON DB)
connectDB();

// Middleware
app.use(cors());
app.use(express.json({ limit: '500mb' }));
app.use(express.urlencoded({ limit: '500mb', extended: true }));

// Serve static frontend assets
app.use(express.static(path.resolve(__dirname, '../frontend')));

// Base Route - serve the frontend HTML
app.get('/', (req, res) => {
  res.sendFile(path.resolve(__dirname, '../frontend/index.html'));
});

// API Info Route
app.get('/api', (req, res) => {
  res.json({ success: true, message: 'Noble High School API is running on port ' + (process.env.PORT || 5000) });
});

// Route to serve default student photo
app.get('/api/students/default-photo', (req, res) => {
  const photoPath = 'C:\\Users\\mandeep reddy\\Downloads\\1b655ef2-0beb-4293-a111-062882cc97cc.png';
  if (fs.existsSync(photoPath)) {
    return res.sendFile(photoPath);
  }
  res.sendFile(path.resolve(__dirname, '../frontend/assets/logo.png'));
});

// Import Routes
const authRoutes = require('./routes/auth');
const studentRoutes = require('./routes/students');
const feeRoutes = require('./routes/fees');
const attendanceRoutes = require('./routes/attendance');
const examRoutes = require('./routes/exams');
const facultyRoutes = require('./routes/faculty');
const complaintRoutes = require('./routes/complaints');
const settingsRoutes = require('./routes/settings');
const notificationRoutes = require('./routes/notifications');
const syncRoutes = require('./routes/sync');

// Mount Routes
app.use('/api/auth', authRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/fees', feeRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/exams', examRoutes);
app.use('/api/faculty', facultyRoutes);
app.use('/api/complaints', complaintRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/sync', syncRoutes);

// Catch-all route to serve frontend for client-side routing
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  res.sendFile(path.resolve(__dirname, '../frontend/index.html'));
});

// Error Handling Middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: err.message || 'Internal Server Error'
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

const https = require('https');
setInterval(() => {
  https.get('https://noble-high-school-management.onrender.com/api', (res) => {
    console.log('[KEEP-ALIVE] Ping: ' + res.statusCode);
  }).on('error', (err) => {
    console.log('[KEEP-ALIVE] Error: ' + err.message);
  });
}, 840000);
