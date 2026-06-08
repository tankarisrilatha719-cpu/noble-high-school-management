const fs = require('fs');
const path = require('path');

const DB_FILE_PATH = path.resolve(__dirname, '../db-fallback.json');

function reset() {
  console.log('Starting DB reset process...');
  
  let adminUser = {
    _id: "admin_noble_id",
    loginId: "admin_noble",
    password: "$2a$10$OMr3CBU4Rdv7UOXGXSEJDuU17bz0xV6kj.XjecaZBwLR4O/BGc/ay",
    role: "admin",
    email: "tankarisrilatha719@gmail.com",
    createdAt: new Date().toISOString()
  };

  // Try to preserve existing admin if file exists
  if (fs.existsSync(DB_FILE_PATH)) {
    try {
      const existing = JSON.parse(fs.readFileSync(DB_FILE_PATH, 'utf8'));
      if (existing.users && existing.users.length > 0) {
        const admin = existing.users.find(u => u.role === 'admin');
        if (admin) {
          adminUser = admin;
          console.log('Preserved existing admin user details.');
        }
      }
    } catch (e) {
      console.log('Failed to read existing file, using default admin.');
    }
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
  console.log('Database has been completely cleared. Ready for fresh test!');
}

reset();
