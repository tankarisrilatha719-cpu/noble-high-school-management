const fs = require('fs');
const path = require('path');
require('dotenv').config();

const envPaths = [
  path.resolve(__dirname, '../../school-config.env'),
  path.resolve(__dirname, '../../New folder (8)/school-config.env'),
  path.resolve(__dirname, '../school-config.env'),
  path.resolve(__dirname, './school-config.env')
];

for (const envPath of envPaths) {
  if (fs.existsSync(envPath)) {
    require('dotenv').config({ path: envPath });
    break;
  }
}

const express = require('express');
const cors = require('cors');
const connectDB = require('./src/config/db');

const app = express();

// Connect to MongoDB
connectDB();

// Middleware
app.use(cors());
app.use(express.json({ limit: '500mb' }));
app.use(express.urlencoded({ limit: '500mb', extended: true }));

// Base Route - serve the frontend HTML monolith
app.get('/', (req, res) => {
  res.sendFile(path.resolve(__dirname, '../noble-school-NO-signature-white-icons_1.html'));
});

// API Info Route
app.get('/api', (req, res) => {
  res.json({ message: 'Noble High School API is running...' });
});

// Route to serve default student photo from user's Downloads folder
app.get('/api/students/default-photo', (req, res) => {
  res.sendFile('C:\\Users\\mandeep reddy\\Downloads\\1b655ef2-0beb-4293-a111-062882cc97cc.png');
});

// Import Routes
const authRoutes = require('./src/routes/auth');
const studentRoutes = require('./src/routes/students');
const feeRoutes = require('./src/routes/fees');
const attendanceRoutes = require('./src/routes/attendance');
const examRoutes = require('./src/routes/exams');
const facultyRoutes = require('./src/routes/faculty');
const complaintRoutes = require('./src/routes/complaints');
const settingsRoutes = require('./src/routes/settings');
const notificationRoutes = require('./src/routes/notifications');
const syncRoutes = require('./src/routes/sync');

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
// Nodemon restart trigger: 2

const https = require('https');
setInterval(() => {
  https.get('https://noble-high-school-management.onrender.com/api', (res) => {
    console.log('[KEEP-ALIVE] Ping: ' + res.statusCode);
  }).on('error', (err) => {
    console.log('[KEEP-ALIVE] Error: ' + err.message);
  });
}, 840000);
