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
│   ├── .env                      # Your local settings (never commit this file)
│   ├── .env.example              # Template listing every setting
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
3. Copy `.env.example` to `.env` and fill it in. `JWT_SECRET` is required
   (at least 32 random characters); the server will not start without it.
   Generate one with:
   ```bash
   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
   ```
4. Start the server:
   ```bash
   npm start
   # or for development with auto-reload:
   npm run dev
   ```
5. Access the portal in your browser at:
   ```
   http://localhost:5000/
   ```

---

### Production settings (Render)
Set these as environment variables on the hosting service, not in a file:
`NODE_ENV=production`, `MONGODB_URI`, `JWT_SECRET`, and either `RESEND_API_KEY`
or `EMAIL_USER` + `EMAIL_APP_PASSWORD` (admin login sends a one-time code by
email and fails if email is not configured). Online fee payment is enabled
only when `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` are set.

### How access works
* Visitors can read only public content (posters, gallery, activities, faculty)
  and submit the admission and Parent Help Desk forms.
* Students log in with their Login ID and password and receive only their own
  records.
* Admins log in with password + CAPTCHA + emailed OTP. Only admins can change
  school data. Changing admin credentials requires a fresh OTP.

### Cache busting
`index.html` loads CSS and JS with a `?v=` number. Increase it whenever you
change `styles.css`, `app.js`, `ui.js` or `chatbot.js` so browsers fetch the new files.

---

## Key Modules
* **Public Portal**: School information, courses, gallery, notices, admissions, and Noble Mitra chatbot.
* **Student Portal**: Profile overview, fee payment via Razorpay, exam timetables, hall tickets, and grievance filing.
* **Admin Dashboard**: Student management, batch operations, fee collection, attendance tracking, exams & grading, faculty directory, announcement broadcasting, and system settings.
