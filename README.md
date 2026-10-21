# Noble High School - School Management System

A web-based School Management Portal for Noble High School.

---

## Architecture & Directory Structure

```text
noble-school-refactored/
├── frontend/
│   ├── assets/
│   │   └── logo.png              # School emblem and identity asset
│   ├── css/
│   │   └── styles.css            # Application stylesheets & design system
│   ├── js/
│   │   ├── app.js                # Core frontend SPA application logic
│   │   └── chatbot.js            # Noble Mitra multilingual chatbot assistant
│   └── index.html                # Main frontend entry point
├── backend/
│   ├── config/
│   │   └── db.js                 # Database connector with local JSON fallback
│   ├── middleware/
│   │   └── auth.js               # JWT verification & role authorization
│   ├── models/                   # Mongoose data models
│   │   ├── Attendance.js
│   │   ├── Complaint.js
│   │   ├── Exam.js
│   │   ├── Faculty.js
│   │   ├── Fee.js
│   │   ├── Notification.js
│   │   ├── Settings.js
│   │   ├── Student.js
│   │   └── User.js
│   ├── routes/                   # API endpoint routers
│   │   ├── attendance.js
│   │   ├── auth.js
│   │   ├── complaints.js
│   │   ├── exams.js
│   │   ├── faculty.js
│   │   ├── fees.js
│   │   ├── notifications.js
│   │   ├── settings.js
│   │   ├── students.js
│   │   └── sync.js
│   ├── utils/
│   │   ├── emailService.js       # SMTP email & OTP notification service
│   │   └── ttlStore.js           # Session and verification code store
│   ├── .env                      # Environment configuration
│   ├── .env.example
│   ├── package.json
│   └── server.js                 # Express server entry point (Port 5000)
├── database/
│   ├── db-fallback.json          # Offline / local mock database
│   ├── seed-db.js                # Default admin and settings seeder
│   ├── seed_test_students.js     # Student sample generator
│   ├── reset-db.js               # Database wipe and reset script
│   ├── clear-mongodb.js          # MongoDB Atlas collection clearing utility
│   └── reset-admin-password.js   # Admin password reset utility
├── docs/
│   ├── noble-school-postman-collection.json
│   └── noble-school-postman-environment.json
├── .gitignore
├── .vercelignore
└── README.md
```

---

## Getting Started

### Prerequisites
* Node.js (v18 or higher recommended)
* MongoDB (or use the built-in local JSON fallback engine)

### Setup & Run
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Install dependencies (if not already installed):
   ```bash
   npm install
   ```
3. Start the server:
   ```bash
   npm start
   # or for development with auto-reload:
   npm run dev
   ```
4. Access the portal in your browser at:
   ```
   http://localhost:5000/
   ```

---

## Key Modules
* **Public Portal**: School information, courses, gallery, notices, admissions, and Noble Mitra chatbot.
* **Student Portal**: Profile overview, fee payment via Razorpay, exam timetables, hall tickets, and grievance filing.
* **Admin Dashboard**: Student management, batch operations, fee collection, attendance tracking, exams & grading, faculty directory, announcement broadcasting, and system settings.
