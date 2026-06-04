const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config();

// Load environment configurations (school-config.env)
const envPaths = [
  path.resolve(__dirname, '../school-config.env'),
  path.resolve(__dirname, './school-config.env')
];
for (const envPath of envPaths) {
  if (fs.existsSync(envPath)) {
    require('dotenv').config({ path: envPath });
    break;
  }
}

const DB_FILE_PATH = path.resolve(__dirname, './db-fallback.json');

// Pre-computed hash of "student12345" so we don't slow down by hashing 13,000 times
const STUDENT_PASSWORD_HASH = '$2a$10$IHPAHJEJklwd.SZx.j4d3OkBDuUVKqumkyzMq.lMBOsRg/a/M1AcK';

const maleFirstNames = [
  'Sai', 'Rahul', 'Venkatesh', 'Sandeep', 'Mandeep', 'Karthik', 'Anand', 'Ravi', 'Prasad', 'Hari',
  'Vijay', 'Sanjay', 'Vikram', 'Ajay', 'Varun', 'Tarun', 'Naveen', 'Rakesh', 'Suresh', 'Naresh',
  'Mahesh', 'Kiran', 'Pavan', 'Aditya', 'Arjun', 'Pranav', 'Rohan', 'Abhishek', 'Ganesh', 'Dinesh',
  'Ramesh', 'Satish', 'Pradeep', 'Sunil', 'Anil', 'Vivek', 'Nikhil', 'Manish', 'Rajesh', 'Harish',
  'Prakash', 'Shiva', 'Bhanu', 'Siddharth', 'Teja', 'Kalyan', 'Vikas', 'Yash', 'Charan', 'Nani'
];

const femaleFirstNames = [
  'Srilatha', 'Harika', 'Anjali', 'Sneha', 'Divya', 'Pooja', 'Jyothi', 'Kavitha', 'Swapna', 'Swathi',
  'Priya', 'Deepika', 'Anusha', 'Keerthi', 'Radhika', 'Rani', 'Sravani', 'Pranitha', 'Lahari', 'Nandini',
  'Manasa', 'Vennela', 'Sushma', 'Gauthami', 'Mythili', 'Sindhu', 'Aishwarya', 'Meghana', 'Divyasri', 'Deepa',
  'Sandhya', 'Madhavi', 'Lalitha', 'Yamini', 'Bhavana', 'Roja', 'Kalyani', 'Vasudha', 'Uma', 'Pavani',
  'Sirisha', 'Sailaja', 'Lavanya', 'Prathyusha', 'Renuka', 'Swetha', 'Preethi', 'Nikitha', 'Gayathri', 'Pallavi'
];

const lastNames = ['Reddy', 'Rao', 'Kumar', 'Yadav', 'Goud', 'Raju', 'Sharma', 'Naidu', 'Chowdary', 'Verma'];

const classes = ['Nursery', 'LKG', 'UKG', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];

// Helper to generate a random item from an array
const randomItem = (arr) => arr[Math.floor(Math.random() * arr.length)];

// Generate 12-digit Aadhaar number
const generateAadhaar = (index) => {
  return (100000000000 + index).toString();
};

// Generate 10-digit Phone number
const generatePhone = (index) => {
  return (9000000000 + index).toString();
};

async function seed() {
  console.log('Generating 13,000 student records (500 males, 500 females per class)...');
  
  // Clean start for the seeder to make sure we have exactly 13,000 test users
  const fallbackData = {
    users: [],
    students: []
  };

  // Seed default admin first so that we don't lose it
  const adminSalt = '$2a$10$W4UGQap39x0z6BVIUH7efedciLnd7CoU9DflYqHBLRfW7fmJiWUjm';
  fallbackData.users.push({
    _id: 'admin_noble_id',
    loginId: 'admin_noble',
    password: adminSalt,
    role: 'admin',
    email: 'tankarisrilatha719@gmail.com',
    createdAt: new Date().toISOString()
  });

  let studentIdCounter = 1;
  let phoneIndex = 1000;

  const mongoStudents = [];
  const mongoUsers = [];

  for (const className of classes) {
    let rollNo = 1;

    // Generate 500 unique male names (50 first names * 10 last names)
    for (let f = 0; f < 50; f++) {
      for (let l = 0; l < 10; l++) {
        const firstName = maleFirstNames[f];
        const lastName = lastNames[l];
        const studentName = `${firstName} ${lastName}`;
        const fatherName = `${randomItem(maleFirstNames)} ${lastName}`;
        const studentId = `NHS${studentIdCounter.toString().padStart(5, '0')}`;
        const loginId = `student_m_${firstName.toLowerCase()}_${studentIdCounter}`;

        const phone = `+91 ${generatePhone(phoneIndex)}`;
        const emergencyPhone = `+91 ${generatePhone(phoneIndex + 1)}`;
        const aadhaar = generateAadhaar(phoneIndex);
        const apaar = `APAAR${studentIdCounter.toString().padStart(6, '0')}`;

        const studentRecord = {
          _id: `student_auto_gen_${studentIdCounter}`,
          id: studentId,
          loginId: loginId,
          password: STUDENT_PASSWORD_HASH,
          name: studentName,
          className: className,
          section: 'A',
          rollNo: rollNo.toString(),
          fatherName: fatherName,
          phone: phone,
          emergencyPhone: emergencyPhone,
          aadhaar: aadhaar,
          apaar: apaar,
          address: `${studentIdCounter}, School Road, Kandukur, Telangana`,
          totalFee: 45000,
          academicYear: '2026-2027',
          status: 'active',
          photo: '/api/students/default-photo',
          createdAt: new Date().toISOString()
        };

        const userRecord = {
          _id: `student_user_auto_gen_${studentIdCounter}`,
          loginId: loginId,
          password: STUDENT_PASSWORD_HASH,
          role: 'student',
          createdAt: new Date().toISOString()
        };

        fallbackData.students.push(studentRecord);
        fallbackData.users.push(userRecord);

        mongoStudents.push(studentRecord);
        mongoUsers.push(userRecord);

        studentIdCounter++;
        rollNo++;
        phoneIndex += 2;
      }
    }

    // Generate 500 unique female names (50 first names * 10 last names)
    for (let f = 0; f < 50; f++) {
      for (let l = 0; l < 10; l++) {
        const firstName = femaleFirstNames[f];
        const lastName = lastNames[l];
        const studentName = `${firstName} ${lastName}`;
        const fatherName = `${randomItem(maleFirstNames)} ${lastName}`;
        const studentId = `NHS${studentIdCounter.toString().padStart(5, '0')}`;
        const loginId = `student_f_${firstName.toLowerCase()}_${studentIdCounter}`;

        const phone = `+91 ${generatePhone(phoneIndex)}`;
        const emergencyPhone = `+91 ${generatePhone(phoneIndex + 1)}`;
        const aadhaar = generateAadhaar(phoneIndex);
        const apaar = `APAAR${studentIdCounter.toString().padStart(6, '0')}`;

        const studentRecord = {
          _id: `student_auto_gen_${studentIdCounter}`,
          id: studentId,
          loginId: loginId,
          password: STUDENT_PASSWORD_HASH,
          name: studentName,
          className: className,
          section: 'A',
          rollNo: rollNo.toString(),
          fatherName: fatherName,
          phone: phone,
          emergencyPhone: emergencyPhone,
          aadhaar: aadhaar,
          apaar: apaar,
          address: `${studentIdCounter}, School Road, Kandukur, Telangana`,
          totalFee: 45000,
          academicYear: '2026-2027',
          status: 'active',
          photo: '/api/students/default-photo',
          createdAt: new Date().toISOString()
        };

        const userRecord = {
          _id: `student_user_auto_gen_${studentIdCounter}`,
          loginId: loginId,
          password: STUDENT_PASSWORD_HASH,
          role: 'student',
          createdAt: new Date().toISOString()
        };

        fallbackData.students.push(studentRecord);
        fallbackData.users.push(userRecord);

        mongoStudents.push(studentRecord);
        mongoUsers.push(userRecord);

        studentIdCounter++;
        rollNo++;
        phoneIndex += 2;
      }
    }
  }

  // Write fallback JSON database
  console.log(`Writing 13,000 records to local JSON fallback database: ${DB_FILE_PATH}...`);
  fs.writeFileSync(DB_FILE_PATH, JSON.stringify(fallbackData, null, 2), 'utf8');
  console.log('Local JSON fallback database seeded successfully.');

  // Try writing to MongoDB
  const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/noble-school';
  try {
    console.log(`Connecting to MongoDB at: ${mongoURI}...`);
    await mongoose.connect(mongoURI, { serverSelectionTimeoutMS: 3000 });
    console.log('Connected to MongoDB. Wiping existing students and seeding 13,000 records...');
    
    const StudentModel = require('./src/models/Student');
    const UserModel = require('./src/models/User');

    // Wipe existing students & student users (keep admin users)
    await StudentModel.deleteMany({});
    await UserModel.deleteMany({ role: 'student' });

    // Bulk insert users and students
    // Chunk imports to handle memory pressure if any
    const chunkSize = 2000;
    for (let i = 0; i < mongoStudents.length; i += chunkSize) {
      const studentChunk = mongoStudents.slice(i, i + chunkSize);
      const userChunk = mongoUsers.slice(i, i + chunkSize);
      
      await StudentModel.insertMany(studentChunk);
      await UserModel.insertMany(userChunk);
      console.log(`Successfully imported ${i + studentChunk.length} / 13,000 students to MongoDB...`);
    }

    console.log('MongoDB database seeded successfully with 13,000 students!');
  } catch (err) {
    console.warn(`[MongoDB Warning] Could not seed MongoDB: ${err.message}. (Local JSON database was successfully seeded and will be used as fallback).`);
  } finally {
    await mongoose.disconnect();
    console.log('Seeding script finished.');
    process.exit(0);
  }
}

seed();
