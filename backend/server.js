const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const express = require('express');
const cors = require('cors');
const compression = require('compression');
const connectDB = require('./config/db');

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  console.error('[FATAL] JWT_SECRET must be set to a random string of at least 32 characters.');
  process.exit(1);
}

const app = express();
app.set('trust proxy', 1); // Render sits behind a proxy; needed for per-IP rate limits
app.disable('x-powered-by');


// Only our own site may call the API from a browser. Extra origins can be
// allowed with ALLOWED_ORIGINS=https://a.example,https://b.example
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'https://noble-high-school-management.onrender.com')
  .split(',').map(s => s.trim()).filter(Boolean);
app.use(cors({
  origin(origin, cb) {
    if (!origin) return cb(null, true); // same-origin requests and server-to-server
    const local = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
    cb(null, local || allowedOrigins.includes(origin));
  }
}));

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(self), microphone=(), geolocation=()');
  if (req.secure) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
});

app.use(compression());

// Photo uploads (gallery, posters, faculty) are sent as base64 inside JSON.
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '1mb', extended: true }));

// Serve static frontend assets. HTML is revalidated on every visit; other
// assets may be cached for a day.
app.use(express.static(path.resolve(__dirname, '../frontend'), {
  setHeaders(res, filePath) {
    res.setHeader('Cache-Control', filePath.endsWith('.html') ? 'no-cache' : 'public, max-age=86400');
  }
}));

// Base Route - serve the frontend HTML
app.get('/', (req, res) => {
  res.sendFile(path.resolve(__dirname, '../frontend/index.html'));
});

// API Info Route
app.get('/api', (req, res) => {
  res.json({ success: true, message: 'Noble High School API is running on port ' + (process.env.PORT || 5000) });
});

// Default student photo
app.get('/api/students/default-photo', (req, res) => {
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
const paymentRoutes = require('./routes/payments');

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
app.use('/api/payments', paymentRoutes);

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
  const status = err.type === 'entity.too.large' ? 413 : 500;
  res.status(status).json({
    success: false,
    message: status === 413 ? 'The upload is too large.' : 'Something went wrong. Please try again.'
  });
});

// Decide between MongoDB and the local JSON fallback before taking requests.
const PORT = process.env.PORT || 5000;
connectDB().finally(() => {
  require('./utils/ttlStore').purgeAll();
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
});

// Keep the free Render instance awake in production only.
const https = require('https');
if (process.env.NODE_ENV === 'production') setInterval(() => {
  https.get('https://noble-high-school-management.onrender.com/api', (res) => {
    console.log('[KEEP-ALIVE] Ping: ' + res.statusCode);
  }).on('error', (err) => {
    console.log('[KEEP-ALIVE] Error: ' + err.message);
  });
}, 840000);
