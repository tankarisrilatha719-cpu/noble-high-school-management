const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
// Store original mongoose methods
const originalModel = mongoose.model;
const originalConnect = mongoose.connect;
// Path to the fallback JSON file inside backend folder
const DB_FILE_PATH = path.resolve(__dirname, '../../db-fallback.json');
// Helper to read database file
function readDbFile() {
  try {
    if (!fs.existsSync(DB_FILE_PATH)) {
      return {};
    }
    const content = fs.readFileSync(DB_FILE_PATH, 'utf8');
    return JSON.parse(content || '{}');
  } catch (e) {
    console.error('Error reading fallback DB file:', e);
    return {};
  }
}
// Helper to write database file
function writeDbFile(data) {
  try {
    fs.writeFileSync(DB_FILE_PATH, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.error('Error writing fallback DB file:', e);
  }
}
// Map model name to plural collection name
function getCollectionName(modelName) {
  return modelName.toLowerCase() + 's';
}
// Helper to match Mongoose-style queries
function matchQuery(doc, query) {
  if (!query || typeof query !== 'object') return true;
  
  for (const key in query) {
    if (key === '$or') {
      if (!Array.isArray(query.$or)) return false;
      const matched = query.$or.some(q => matchQuery(doc, q));
      if (!matched) return false;
      continue;
    }
    
    if (key === '$and') {
      if (!Array.isArray(query.$and)) return false;
      const matched = query.$and.every(q => matchQuery(doc, q));
      if (!matched) return false;
      continue;
    }
    const queryVal = query[key];
    const docVal = doc[key];
    if (queryVal && typeof queryVal === 'object') {
      if (queryVal.$regex !== undefined) {
        const flags = queryVal.$options || '';
        const regex = new RegExp(queryVal.$regex, flags);
        if (!regex.test(String(docVal || ''))) return false;
        continue;
      }
      if (queryVal.$in !== undefined) {
        if (!Array.isArray(queryVal.$in)) return false;
        if (!queryVal.$in.includes(docVal)) return false;
        continue;
      }
      if (queryVal.$nin !== undefined) {
        if (!Array.isArray(queryVal.$nin)) return false;
        if (queryVal.$nin.includes(docVal)) return false;
        continue;
      }
      // Simple nested comparison
      if (JSON.stringify(docVal) !== JSON.stringify(queryVal)) return false;
    } else {
      if (docVal !== queryVal) return false;
    }
  }
  return true;
}
// Mock Query for chaining (.sort, .limit, etc)
class MockQuery {
  constructor(results) {
    this.results = [...results];
  }
  select(fields) {
    return this;
  }
  sort(criteria) {
    if (criteria && typeof criteria === 'object') {
      const keys = Object.keys(criteria);
      if (keys.length > 0) {
        const key = keys[0];
        const order = criteria[key];
        this.results.sort((a, b) => {
          const valA = a[key];
          const valB = b[key];
          if (valA < valB) return order === 1 ? -1 : 1;
          if (valA > valB) return order === 1 ? 1 : -1;
          return 0;
        });
      }
    }
    return this;
  }
  limit(n) {
    this.results = this.results.slice(0, n);
    return this;
  }
  skip(n) {
    this.results = this.results.slice(n);
    return this;
  }
  then(onFulfilled, onRejected) {
    return Promise.resolve(this.results).then(onFulfilled, onRejected);
  }
  catch(onRejected) {
    return Promise.resolve(this.results).catch(onRejected);
  }
}
// Mock FindOne Query
class MockFindOneQuery {
  constructor(result) {
    this.result = result;
  }
  select(fields) {
    return this;
  }
  then(onFulfilled, onRejected) {
    return Promise.resolve(this.result).then(onFulfilled, onRejected);
  }
  catch(onRejected) {
    return Promise.resolve(this.result).catch(onRejected);
  }
}
// Mock Document Instance
class MockDocument {
  constructor(modelName, data, schema) {
    this._modelName = modelName;
    this._schema = schema;
    
    Object.assign(this, data);
    
    if (!this._id) {
      this._id = Math.random().toString(36).substring(2, 9) + Math.random().toString(36).substring(2, 9);
    }
    
    if (schema && schema.methods) {
      for (const methodName in schema.methods) {
        this[methodName] = schema.methods[methodName].bind(this);
      }
    }
  }
  isModified(field) {
    return true;
  }
  async save() {
    // Run pre-save hooks
    if (this._schema && this._schema._preHooks && this._schema._preHooks['save']) {
      for (const hookFn of this._schema._preHooks['save']) {
        await new Promise((resolve, reject) => {
          hookFn.call(this, (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
      }
    }
    const data = readDbFile();
    const collectionName = getCollectionName(this._modelName);
    if (!data[collectionName]) data[collectionName] = [];
    
    const index = data[collectionName].findIndex(d => d._id === this._id || (this.id && d.id === this.id));
    const plainData = Object.keys(this)
      .filter(key => !key.startsWith('_'))
      .reduce((obj, key) => {
        obj[key] = this[key];
        return obj;
      }, {});
    
    plainData._id = this._id;
    if (index >= 0) {
      data[collectionName][index] = plainData;
    } else {
      data[collectionName].push(plainData);
    }
    writeDbFile(data);
    
    // Run post-save hooks
    if (this._schema && this._schema._postHooks && this._schema._postHooks['save']) {
      for (const hookFn of this._schema._postHooks['save']) {
        hookFn.call(this, this);
      }
    }
    return this;
  }
}
// Mock Model Class
class MockModel {
  constructor(modelName, schema) {
    this.name = modelName;
    this.schema = schema;
  }
  find(query) {
    const dbData = readDbFile();
    const collection = dbData[getCollectionName(this.name)] || [];
    const filtered = collection.filter(doc => matchQuery(doc, query));
    const docs = filtered.map(d => new MockDocument(this.name, d, this.schema));
    return new MockQuery(docs);
  }
  findOne(query) {
    const dbData = readDbFile();
    const collection = dbData[getCollectionName(this.name)] || [];
    const filtered = collection.filter(doc => matchQuery(doc, query));
    
    if (filtered.length > 0) {
      const doc = new MockDocument(this.name, filtered[0], this.schema);
      return new MockFindOneQuery(doc);
    }
    return new MockFindOneQuery(null);
  }
  findById(id) {
    return this.findOne({ _id: id });
  }
  async create(docData) {
    if (Array.isArray(docData)) {
      const docs = [];
      for (const item of docData) {
        const doc = new MockDocument(this.name, item, this.schema);
        await doc.save();
        docs.push(doc);
      }
      return docs;
    }
    
    const doc = new MockDocument(this.name, docData, this.schema);
    await doc.save();
    return doc;
  }
  async findOneAndUpdate(query, update, options = {}) {
    const dbData = readDbFile();
    const collectionName = getCollectionName(this.name);
    const collection = dbData[collectionName] || [];
    const index = collection.findIndex(doc => matchQuery(doc, query));
    
    if (index >= 0) {
      const originalDoc = collection[index];
      let updatedDoc = { ...originalDoc };
      
      if (update && typeof update === 'object') {
        const updateData = update.$set || update;
        Object.assign(updatedDoc, updateData);
      }
      
      collection[index] = updatedDoc;
      dbData[collectionName] = collection;
      writeDbFile(dbData);
      
      const doc = new MockDocument(this.name, updatedDoc, this.schema);
      return doc;
    }
    return null;
  }
  async findByIdAndUpdate(id, update, options = {}) {
    return this.findOneAndUpdate({ _id: id }, update, options);
  }
  async findOneAndDelete(query) {
    const dbData = readDbFile();
    const collectionName = getCollectionName(this.name);
    const collection = dbData[collectionName] || [];
    const index = collection.findIndex(doc => matchQuery(doc, query));
    
    if (index >= 0) {
      const deletedDoc = collection[index];
      collection.splice(index, 1);
      dbData[collectionName] = collection;
      writeDbFile(dbData);
      return new MockDocument(this.name, deletedDoc, this.schema);
    }
    return null;
  }
  async findByIdAndDelete(id) {
    return this.findOneAndDelete({ _id: id });
  }
  async deleteMany(query = {}) {
    const dbData = readDbFile();
    const collectionName = getCollectionName(this.name);
    const collection = dbData[collectionName] || [];
    const remaining = collection.filter(doc => !matchQuery(doc, query));
    dbData[collectionName] = remaining;
    writeDbFile(dbData);
    return { deletedCount: collection.length - remaining.length };
  }
  async countDocuments(query) {
    const dbData = readDbFile();
    const collection = dbData[getCollectionName(this.name)] || [];
    const filtered = collection.filter(doc => matchQuery(doc, query));
    return filtered.length;
  }
}
// Pre/Post hooks capture
const originalPre = mongoose.Schema.prototype.pre;
mongoose.Schema.prototype.pre = function(name, fn) {
  if (!this._preHooks) this._preHooks = {};
  if (!this._preHooks[name]) this._preHooks[name] = [];
  this._preHooks[name].push(fn);
  return originalPre.apply(this, arguments);
};
const originalPost = mongoose.Schema.prototype.post;
mongoose.Schema.prototype.post = function(name, fn) {
  if (!this._postHooks) this._postHooks = {};
  if (!this._postHooks[name]) this._postHooks[name] = [];
  this._postHooks[name].push(fn);
  return originalPost.apply(this, arguments);
};
// Seed default admin and test student
async function seedDefaultAdmin() {
  const dbData = readDbFile();
  if (!dbData.users) dbData.users = [];
  
  const adminExists = dbData.users.some(u => u.loginId === 'admin_noble');
  if (!adminExists) {
    console.log('[DATABASE FALLBACK] Seeding default admin_noble user...');
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash('noble2026password', salt);
    
    dbData.users.push({
      _id: 'admin_noble_id',
      loginId: 'admin_noble',
      password: passwordHash,
      role: 'admin',
      email: process.env.EMAIL_USER || 'tankarisrilatha719@gmail.com',
      createdAt: new Date().toISOString()
    });
    
    writeDbFile(dbData);
    console.log('[DATABASE FALLBACK] Default admin_noble seeded successfully.');
  }
  // Seed default test student "NHS001"
  if (!dbData.students) dbData.students = [];
  const studentExists = dbData.students.some(s => s.id === 'NHS001');
  if (!studentExists) {
    console.log('[DATABASE FALLBACK] Seeding default student NHS001 (Rahul Reddy)...');
    
    dbData.students.push({
      _id: 'student_rahul_id',
      id: 'NHS001',
      loginId: 'student_rahul',
      name: 'Rahul Reddy',
      className: '10',
      section: 'A',
      rollNo: '12',
      fatherName: 'Venkata Reddy',
      phone: '+91 90599 92147',
      emergencyPhone: '+91 90599 92147',
      aadhaar: '123456789012',
      totalFee: 45000,
      academicYear: '2026-2027',
      status: 'active',
      createdAt: new Date().toISOString()
    });
    
    // Also add to users table for student portal login access
    const studentUserExists = dbData.users.some(u => u.loginId === 'student_rahul');
    if (!studentUserExists) {
      const studentSalt = await bcrypt.genSalt(10);
      const studentPassHash = await bcrypt.hash('student12345', studentSalt);
      dbData.users.push({
        _id: 'student_user_rahul_id',
        loginId: 'student_rahul',
        password: studentPassHash,
        role: 'student',
        createdAt: new Date().toISOString()
      });
    }
    
    writeDbFile(dbData);
    console.log('[DATABASE FALLBACK] Default student NHS001 seeded successfully.');
  }
}
const mockModels = new Map();
mongoose.model = function(name, schema) {
  let realModel;
  try {
    realModel = originalModel.call(mongoose, name, schema);
  } catch (err) {
    realModel = mongoose.models[name] || mongoose.model(name);
  }
  let mockModel = mockModels.get(name);
  if (!mockModel) {
    mockModel = new MockModel(name, schema);
    mockModels.set(name, mockModel);
  }
  const DynamicModel = new Proxy(realModel, {
    get(target, prop, receiver) {
      if (global.useMongooseMock) {
        const val = Reflect.get(mockModel, prop, receiver);
        if (typeof val === 'function') {
          return val.bind(mockModel);
        }
        return val;
      }
      return Reflect.get(target, prop, receiver);
    },
    construct(target, args, newTarget) {
      if (global.useMongooseMock) {
        const data = args[0] || {};
        return new MockDocument(name, data, schema);
      }
      return Reflect.construct(target, args, newTarget);
    }
  });
  return DynamicModel;
};
mongoose.connect = async function(uri, options) {
  try {
    console.log(`[DATABASE] Connecting to MongoDB: ${uri}...`);
    const conn = await originalConnect.call(mongoose, uri, {
      ...options,
      serverSelectionTimeoutMS: 3000 // 3s timeout
    });
    console.log(`[DATABASE] MongoDB Connected Successfully: ${conn.connection.host}`);
    global.useMongooseMock = false;
    return conn;
  } catch (error) {
    console.warn(`[DATABASE WARNING] MongoDB connection failed: ${error.message}`);
    console.log(`[DATABASE FALLBACK] Swapping to Local JSON database fallback (db-fallback.json)...`);
    global.useMongooseMock = true;
    await seedDefaultAdmin();
    return {
      connection: {
        host: 'LocalJSONFallback'
      }
    };
  }
};
const connectDB = async () => {
  // Trigger mongoose.connect which will try to connect and fallback to local JSON database if failed
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/noble-school';
  await mongoose.connect(uri);
};
module.exports = connectDB;