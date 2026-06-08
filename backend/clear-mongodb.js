const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '.env') });

const DB_FILE_PATH = path.resolve(__dirname, '../db-fallback.json');

async function clearDatabase() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI not found in environment variables.');
    process.exit(1);
  }

  console.log('Connecting to MongoDB Atlas...');
  await mongoose.connect(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  });
  console.log('Connected successfully!');

  // Define models directly to avoid any missing model errors
  const Student = mongoose.models.Student || mongoose.model('Student', new mongoose.Schema({}, { strict: false }));
  const User = mongoose.models.User || mongoose.model('User', new mongoose.Schema({}, { strict: false }));
  const Fee = mongoose.models.Fee || mongoose.model('Fee', new mongoose.Schema({}, { strict: false }));
  const Attendance = mongoose.models.Attendance || mongoose.model('Attendance', new mongoose.Schema({}, { strict: false }));
  const Complaint = mongoose.models.Complaint || mongoose.model('Complaint', new mongoose.Schema({}, { strict: false }));
  const Notification = mongoose.models.Notification || mongoose.model('Notification', new mongoose.Schema({}, { strict: false }));
  const FallbackStore = mongoose.models.FallbackStore || mongoose.model('FallbackStore', new mongoose.Schema({}, { strict: false }));

  console.log('Clearing MongoDB collections...');
  
  const studentResult = await Student.deleteMany({});
  console.log(`Deleted ${studentResult.deletedCount} students.`);

  const userResult = await User.deleteMany({ role: { $ne: 'admin' } });
  console.log(`Deleted ${userResult.deletedCount} student users (preserved admin users).`);

  const feeResult = await Fee.deleteMany({});
  console.log(`Deleted ${feeResult.deletedCount} fee records.`);

  const attResult = await Attendance.deleteMany({});
  console.log(`Deleted ${attResult.deletedCount} attendance records.`);

  const compResult = await Complaint.deleteMany({});
  console.log(`Deleted ${compResult.deletedCount} complaint records.`);

  const notifResult = await Notification.deleteMany({});
  console.log(`Deleted ${notifResult.deletedCount} notifications.`);

  const fallbackResult = await FallbackStore.deleteMany({});
  console.log(`Deleted ${fallbackResult.deletedCount} synced fallback stores.`);

  console.log('MongoDB Atlas clean up finished!');

  // Now clear the local db-fallback.json file too
  console.log('Clearing local db-fallback.json...');
  let adminUser = {
    _id: "admin_noble_id",
    loginId: "admin_noble",
    password: "$2a$10$OMr3CBU4Rdv7UOXGXSEJDuU17bz0xV6kj.XjecaZBwLR4O/BGc/ay",
    role: "admin",
    email: "tankarisrilatha719@gmail.com",
    createdAt: new Date().toISOString()
  };

  if (fs.existsSync(DB_FILE_PATH)) {
    try {
      const existing = JSON.parse(fs.readFileSync(DB_FILE_PATH, 'utf8'));
      if (existing.users && existing.users.length > 0) {
        const admin = existing.users.find(u => u.role === 'admin');
        if (admin) adminUser = admin;
      }
    } catch (e) {}
  }

  const freshDb = {
    users: [adminUser],
    students: [],
    notifications: [],
    fees: [],
    archived: [],
    complaints: [],
    attendance: {},
    reports: [],
    admissions: [],
    holidays: [],
    exams: [],
    leaves: [],
    hallTickets: []
  };

  fs.writeFileSync(DB_FILE_PATH, JSON.stringify(freshDb, null, 2), 'utf8');
  console.log('Local fallback JSON cleared.');

  await mongoose.disconnect();
  console.log('Disconnected from MongoDB.');
}

clearDatabase().catch(err => {
  console.error('Failed to clear database:', err);
  process.exit(1);
});
