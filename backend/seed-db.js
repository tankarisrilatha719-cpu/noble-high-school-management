const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const DB_FILE_PATH = path.resolve(__dirname, '../db-fallback.json');

// Indian names lists
const firstNames = [
  'Aarav', 'Vihaan', 'Aditya', 'Sai', 'Arjun', 'Krishna', 'Rahul', 'Rohan', 'Pranav', 'Dev',
  'Ananya', 'Diya', 'Ira', 'Sana', 'Riya', 'Kavya', 'Pooja', 'Neha', 'Aditi', 'Sia',
  'Manoj', 'Kiran', 'Sanjay', 'Vijay', 'Rajesh', 'Suresh', 'Anil', 'Sunil', 'Naresh', 'Ramesh',
  'Harish', 'Ganesh', 'Dinesh', 'Sandeep', 'Mandeep', 'Nitin', 'Vikram', 'Vivek', 'Praveen', 'Deepak',
  'Amit', 'Sumit', 'Vikrant', 'Karthik', 'Srinivas', 'Subhash', 'Varun', 'Tarun', 'Yash', 'Rishi',
  'Shreya', 'Sneha', 'Tanvi', 'Anjali', 'Divya', 'Priyanka', 'Meera', 'Radha', 'Gita', 'Swati'
];

const lastNames = [
  'Reddy', 'Patel', 'Sharma', 'Verma', 'Gupta', 'Rao', 'Naidu', 'Kumar', 'Singh', 'Joshi',
  'Mehta', 'Chawla', 'Kapoor', 'Nair', 'Pillai', 'Iyer', 'Sastry', 'Prasad', 'Babu', 'Sen',
  'Das', 'Roy', 'Bhat', 'Shenoy', 'Pai', 'Murthy', 'Goud', 'Raju', 'Deshmukh', 'Kulkarni'
];

const classes = ['Nursery', 'LKG', 'UKG', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];

// Character map for student password encoding
const _CHAR_MAP = {
  'A':'7*k9P!mQ','B':'2#mQv&zL','C':'L5&tS9!w','D':'9!wX1@rZ','E':'b4@rZ*kN',
  'F':'G8^nJ3$a','G':'0%hV6vB9','H':'kM3$YpC2','I':'1(pL9fS6','J':'qW2!f7*k',
  'K':'5*dN8xM9','L':'rT0#xbL0','M':'jZ7@b4#b','N':'6&uK4rY2','O':'vB9%m1^j',
  'P':'3$aC2vD3','Q':'fY1^gqW0','R':'xO5*k9%k','S':'nL8!h5*r','T':'4@sR0bP0',
  'U':'iE6&w7&z','V':'zQ3#j1*v','W':'pD9%v0%m','X':'7*mN1fP9','Y':'uY4$t3!x',
  'Z':'2!kX8uD6',
  'a':'k8*P9!mQ','b':'v2#mQz&L','c':'sL5&t9!w','d':'r9!wX@rZ','e':'zb4@r*kN',
  'f':'jG8^n3$a','g':'v0%hVvB9','h':'ykM3$pC2','i':'91(pLfS6','j':'fqW2!7*k',
  'k':'85*dNxM9','l':'xrT0#bL0','m':'bjZ7@4#b','n':'26&uKrY2','o':'mvB9%1^j',
  'p':'33$aCvD3','q':'gfY1^qW0','r':'kxO5*9%k','s':'hnL8!5*r','t':'04@sRbP0',
  'u':'wiE6&7&z','v':'jzQ3#1*v','w':'vpD9%0%m','x':'17*mNfP9','y':'tuY4$3!x',
  'z':'82!kXuD6',
  '0':'wQ5&k7*b','1':'9*rP2pZ1','2':'bL0#v4#b','3':'7!mX49!z','4':'kZ8@nkM6',
  '5':'1$jT33*t','6':'fS6^grY2','7':'xM9%h5^n','8':'pC2!wjP9','9':'uR5*y1(h',
  ' ':'9!zL1vD3','@':'4#bV80)x','$':'kM6&p7!f','%':'3*tX0bK5','^':'rY2@sqW0',
  '&':'5^nQ7mZ8','(':'1(hB41^j',')':'0)xM69%k','_':'7!fR94!h','=':'bK5*tbP0',
  '[':'mZ8$p1*v',']':'xS2@l0%m','{':'1^jV4fP9','}':'9%kQ03!x','|':'4!hM77*b',
  ':':'bP0#xpZ1',';':'7&zL94#b',"'":'qY2$w9!z','"':'kS5^nkM6',',':'1vR83t',
  '.':'0%mQ3rY2','/':'fP9@k5^n','?':'3!xJ2jP9','<':'uD6&t1(h','!':'pZ1$wvD3',
  '#':'aE7@m6&L','*':'b0)kS9rY','+':'cP3!nT8x','-':'dQ4#xJ2j','>':'eR5^vB9%',
  '~':'fT6&w7&z','`':'gU7$tuY4','\\':'hV8@l0%m'
};

function encodePassword(plain) {
  if (plain == null) return '';
  let out = '';
  for (let i = 0; i < plain.length; i++) {
    const ch = plain[i];
    out += (_CHAR_MAP[ch] !== undefined ? _CHAR_MAP[ch] : ch);
  }
  return out;
}

function getSubjectsByClass(cls) {
  const n = parseInt(cls);
  if (cls==='Nursery'||cls==='LKG'||cls==='UKG') return ['Telugu','English','Maths','Science','EVS','Rhymes'];
  if (n>=1&&n<=5) return ['Telugu','Hindi','English','Maths','Science','EVS','Computer'];
  if (n>=6&&n<=10) return ['Telugu','Hindi','English','Maths','Science','Social'];
  return ['Telugu','English','Maths'];
}

async function seed() {
  console.log('Starting DB seeding process...');

  let db = {
    users: [],
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

  // Keep existing admin user if it exists in db-fallback.json
  if (fs.existsSync(DB_FILE_PATH)) {
    try {
      const existing = JSON.parse(fs.readFileSync(DB_FILE_PATH, 'utf8'));
      if (existing.users && existing.users.length > 0) {
        // Find admin user
        const admin = existing.users.find(u => u.role === 'admin');
        if (admin) {
          db.users.push(admin);
          console.log('Preserved existing admin user.');
        }
      }
    } catch (e) {
      console.log('No existing DB file or failed to read, starting fresh.');
    }
  }

  // If no admin was preserved, add default admin
  if (db.users.length === 0) {
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash('noble2026password', salt);
    db.users.push({
      _id: "admin_noble_id",
      loginId: "admin_noble",
      password: passwordHash,
      role: "admin",
      email: "tankarisrilatha719@gmail.com",
      createdAt: new Date().toISOString()
    });
    console.log('Created default admin user: admin_noble / noble2026password');
  }

  let studentIdCounter = 100; // Start NHS100 onwards
  const studentPasswordPlain = 'student123';
  const studentPasswordEncoded = encodePassword(studentPasswordPlain);
  
  // Bcrypt salt for creating User collections (stored in backend)
  const salt = await bcrypt.genSalt(10);
  const studentBcryptHash = await bcrypt.hash(studentPasswordPlain, salt);

  const attendanceDates = ['2026-06-01', '2026-06-02', '2026-06-03', '2026-06-04', '2026-06-05'];

  for (const cls of classes) {
    console.log(`Generating 30 students, reports, and attendance for Class ${cls}...`);
    const classStudents = [];
    
    for (let roll = 1; roll <= 30; roll++) {
      const fName = firstNames[Math.floor(Math.random() * firstNames.length)];
      const lName = lastNames[Math.floor(Math.random() * lastNames.length)];
      const fatherFName = firstNames[Math.floor(Math.random() * firstNames.length)];
      
      const studentId = `NHS${studentIdCounter++}`;
      const name = `${fName} ${lName}`;
      const fatherName = `${fatherFName} ${lName}`;
      
      const phone = `+91 9${Math.floor(100000000 + Math.random() * 900000000)}`;
      const emergencyPhone = `+91 8${Math.floor(100000000 + Math.random() * 900000000)}`;
      
      const classNum = parseInt(cls);
      let totalFee = 35000;
      if (cls === 'Nursery' || cls === 'LKG' || cls === 'UKG') totalFee = 30000;
      else if (classNum >= 6) totalFee = 45000;
      
      const student = {
        _id: `stu_${studentId}_id`,
        id: studentId,
        loginId: studentId,
        name,
        className: cls,
        section: 'A', // Start all in section A
        rollNo: roll.toString(),
        fatherName,
        phone,
        emergencyPhone,
        aadhaar: Math.floor(100000000000 + Math.random() * 900000000000).toString(),
        totalFee,
        academicYear: '2026-2027',
        status: 'active',
        password: studentPasswordEncoded,
        createdAt: new Date().toISOString()
      };
      
      db.students.push(student);
      classStudents.push(student);
      
      // Create user credential for this student
      db.users.push({
        _id: `user_${studentId}_id`,
        loginId: studentId,
        password: studentBcryptHash, // hashed for backend auth verification
        role: 'student',
        createdAt: new Date().toISOString()
      });
      
      // Generate 2 reports for each student: FA-1 and SA-1
      const subjects = getSubjectsByClass(cls);
      
      // FA-1 Report
      const fa1Marks = {};
      let fa1TotalObtained = 0;
      subjects.forEach(sub => {
        const mark = Math.floor(32 + Math.random() * 18); // 32 to 50
        fa1Marks[sub] = mark;
        fa1TotalObtained += mark;
      });
      
      const fa1Report = {
        id: `REP_FA1_${studentId}`,
        studentId: studentId,
        examName: 'FA-1',
        examType: 'FA',
        totalPerSubj: 50,
        workingDays: 30,
        presentDays: Math.floor(24 + Math.random() * 7), // 24 to 30
        marks: fa1Marks,
        internalMarks: null,
        useInternals: false,
        internalMax: null,
        externalMax: null,
        published: true,
        publishTime: new Date().toISOString(),
        academicYear: '2026-2027',
        className: cls,
        section: 'A',
        lastEditedAt: new Date().toISOString()
      };
      db.reports.push(fa1Report);
      
      // SA-1 Report
      const sa1Marks = {};
      let sa1TotalObtained = 0;
      subjects.forEach(sub => {
        const mark = Math.floor(60 + Math.random() * 40); // 60 to 100
        sa1Marks[sub] = mark;
        sa1TotalObtained += mark;
      });
      
      const sa1Report = {
        id: `REP_SA1_${studentId}`,
        studentId: studentId,
        examName: 'SA-1',
        examType: 'SA',
        totalPerSubj: 100,
        workingDays: 60,
        presentDays: Math.floor(48 + Math.random() * 13), // 48 to 60
        marks: sa1Marks,
        internalMarks: null,
        useInternals: false,
        internalMax: null,
        externalMax: null,
        published: true,
        publishTime: new Date().toISOString(),
        academicYear: '2026-2027',
        className: cls,
        section: 'A',
        lastEditedAt: new Date().toISOString()
      };
      db.reports.push(sa1Report);
    }
    
    // Generate Attendance Records for attendance dates
    attendanceDates.forEach(date => {
      if (!db.attendance[date]) {
        db.attendance[date] = {};
      }
      
      // Randomly select 0 to 2 absent students
      const absentCount = Math.floor(Math.random() * 3); // 0, 1, or 2
      const absentIds = [];
      const tempStudents = [...classStudents];
      for (let a = 0; a < absentCount; a++) {
        if (tempStudents.length > 0) {
          const randIdx = Math.floor(Math.random() * tempStudents.length);
          absentIds.push(tempStudents[randIdx].id);
          tempStudents.splice(randIdx, 1);
        }
      }
      
      // Since all students are initially in Section A, we register for key: cls-A
      db.attendance[date][`${cls}-A`] = {
        absent: absentIds,
        total: 30,
        timestamp: new Date().toISOString()
      };
    });
  }

  // Write to db-fallback.json
  fs.writeFileSync(DB_FILE_PATH, JSON.stringify(db, null, 2), 'utf8');
  console.log(`Database seeded successfully with ${db.students.length} students, ${db.reports.length} report cards, and attendance records!`);
}

seed().catch(err => {
  console.error('Seeding failed:', err);
});
