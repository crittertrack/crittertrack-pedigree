#!/usr/bin/env node
// Setup script for CTU1 admin access
// Run with: node setup-ctu1-admin.js

const mongoose = require('mongoose');

// MongoDB connection from .env
const MONGODB_URI = 'mongodb+srv://crittertrack_app_user_v2:xSmRuas3OVAZGUZD@crittertrack.artyose.mongodb.net/crittertrackdb';

mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('📡 Connected to MongoDB'))
.catch(err => {
  console.error('❌ MongoDB connection error:', err.message);
  process.exit(1);
});

const User = mongoose.model('User', new mongoose.Schema({
  id_public: { type: String, required: false, unique: true, sparse: true, index: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true, select: false },
  personalName: { type: String, required: true, trim: true },
  role: { type: String, default: 'user' },
  adminPassword: { type: String, select: false },
  accountStatus: { type: String, default: 'normal' },
  creationDate: { type: Date, default: Date.now }
}));

async function setupCTU1() {
  try {
    // Find CTU1 by email pattern
    const ctu1 = await User.findOne({ email: /ctu1/i });
    
    if (ctu1) {
      console.log('✅ Found CTU1 account:', ctu1.email);
      console.log('   ID:', ctu1._id);
      console.log('   Current role:', ctu1.role);
      console.log('   adminPassword set:', ctu1.adminPassword ? 'YES' : 'NO');
      
      // Update role to admin
      if (ctu1.role !== 'admin') {
        ctu1.role = 'admin';
        await ctu1.save();
        console.log('   ✅ Role updated to: admin');
      }
      
      // Generate and set admin password
      if (!ctu1.adminPassword) {
        const crypto = require('crypto');
        const generatedPassword = Math.random().toString(36).slice(2, 14);
        const salt = crypto.randomBytes(16).toString('hex');
        const hash = crypto.createHash('sha256').update(generatedPassword + salt).digest('hex');
        
        ctu1.adminPassword = hash;
        await ctu1.save();
        console.log('   ✅ adminPassword set');
        console.log('   🔐 Generated password:', generatedPassword);
      } else {
        console.log('   ℹ️ adminPassword already set, skipping');
      }
      
      console.log('\n=== CTU1 Account Summary ===');
      console.log('Email:', ctu1.email);
      console.log('Role:', ctu1.role);
      console.log('adminPassword set:', ctu1.adminPassword ? 'YES' : 'NO');
      console.log('accountStatus:', ctu1.accountStatus);
      console.log('\n✅ CTU1 is now ready for moderation access!');
    } else {
      console.log('❌ CTU1 account not found in database');
      console.log('   Creating new CTU1 account...');
      
      // Create new CTU1 account
      const newCtu1 = new User({
        email: 'ctu1@crittertrack.net',
        personalName: 'CTU1',
        role: 'admin',
        // Generate password hash
        password: '',  // Will set separately
      });
      
      const salt = require('crypto').randomBytes(16).toString('hex');
      const hash = require('crypto').createHash('sha256').update('TempPass123' + salt).digest('hex');
      
      newCtu1.password = hash;
      newCtu1.adminPassword = hash;
      
      await newCtu1.save();
      console.log('✅ New CTU1 account created!');
      console.log('   Email:', newCtu1.email);
      console.log('   Role:', newCtu1.role);
      console.log('   🔐 Default password: TempPass123');
    }
    
    mongoose.connection.close();
    console.log('\n🔒 Database connection closed');
    
  } catch (error) {
    console.error('❌ Error setting up CTU1:', error.message);
    mongoose.connection.close();
    process.exit(1);
  }
}

setupCTU1();