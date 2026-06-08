const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

dotenv.config({ path: path.resolve(__dirname, '.env') });

const DB_FILE_PATH = path.resolve(__dirname, '../db-fallback.json');

async function reset() {
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash('noble2026password', salt);
  
  console.log('--- RESETTING LOCAL DB FALLBACK ---');
  if (fs.existsSync(DB_FILE_PATH)) {
    try {
      const dbData = JSON.parse(fs.readFileSync(DB_FILE_PATH, 'utf8'));
      if (!dbData.users) dbData.users = [];
      
      let admin = dbData.users.find(u => u.loginId === 'admin_noble');
      if (admin) {
        admin.password = passwordHash;
        console.log('Updated admin_noble password in db-fallback.json');
      } else {
        dbData.users.push({
          _id: 'admin_noble_id',
          loginId: 'admin_noble',
          password: passwordHash,
          role: 'admin',
          email: 'tankarisrilatha719@gmail.com',
          createdAt: new Date().toISOString()
        });
        console.log('Created admin_noble user in db-fallback.json');
      }
      fs.writeFileSync(DB_FILE_PATH, JSON.stringify(dbData, null, 2), 'utf8');
      console.log('Saved db-fallback.json successfully.');
    } catch (e) {
      console.error('Failed to update db-fallback.json:', e);
    }
  } else {
    console.log('db-fallback.json not found, skipping local file update.');
  }

  console.log('\n--- RESETTING MONGODB DATABASE ---');
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.warn('No MONGODB_URI found in environment variables. Skipping MongoDB update.');
    return;
  }
  
  try {
    await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log('Connected to MongoDB.');
    
    const UserSchema = new mongoose.Schema({
      loginId: { type: String, required: true },
      password: { type: String, required: true },
      role: { type: String, required: true },
      email: { type: String }
    });
    
    const User = mongoose.models.User || mongoose.model('User', UserSchema);
    
    let dbAdmin = await User.findOne({ loginId: 'admin_noble' });
    if (dbAdmin) {
      dbAdmin.password = passwordHash;
      await dbAdmin.save();
      console.log('Updated password for admin_noble in MongoDB database.');
    } else {
      await User.create({
        loginId: 'admin_noble',
        password: passwordHash,
        role: 'admin',
        email: 'tankarisrilatha719@gmail.com'
      });
      console.log('Created admin_noble user in MongoDB database.');
    }
  } catch (err) {
    console.error('Failed to update MongoDB database:', err);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
  }
}

reset().catch(err => {
  console.error('Execution error:', err);
  process.exit(1);
});
