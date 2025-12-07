// List all users in the database
require('dotenv').config();
const mongoose = require('mongoose');
const { User } = require('../database/models');

async function listUsers() {
  try {
    const mongoUri = process.env.MONGODB_URI;
    await mongoose.connect(mongoUri);
    console.log('Connected to database\n');

    const users = await User.find({}).select('id_public email personalName breederName createdAt showBreederName');
    
    console.log(`Found ${users.length} user(s):\n`);
    
    users.forEach(user => {
      console.log('─────────────────────────────────────');
      console.log(`Public ID: CTU${user.id_public}`);
      console.log(`Email: ${user.email}`);
      console.log(`Personal Name: ${user.personalName}`);
      console.log(`Breeder Name: ${user.breederName || '(none)'}`);
      console.log(`Show Breeder Name: ${user.showBreederName}`);
      console.log(`Created: ${user.createdAt}`);
    });
    console.log('─────────────────────────────────────\n');

    mongoose.connection.close();
  } catch (error) {
    console.error('Error:', error);
    mongoose.connection.close();
  }
}

listUsers();
