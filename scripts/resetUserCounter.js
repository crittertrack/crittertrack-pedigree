// Reset user counter to ensure next user is CTU2
require('dotenv').config();
const mongoose = require('mongoose');
const { Counter } = require('../database/models');

async function resetUserCounter() {
  try {
    const mongoUri = process.env.MONGODB_URI;
    await mongoose.connect(mongoUri);
    console.log('Connected to database\n');

    // Find or create the User counter (Counter uses _id as the name)
    let counter = await Counter.findOne({ _id: 'userId' });
    
    if (!counter) {
      console.log('User counter does not exist, creating it...');
      counter = await Counter.create({ _id: 'userId', seq: 1 });
      console.log('✓ Created User counter with seq: 1');
    } else {
      console.log('Current User counter seq:', counter.seq);
      
      // Update to 1 so next user will be CTU2
      counter.seq = 1;
      await counter.save();
      console.log('✓ Reset User counter to seq: 1 (next user will be CTU2)');
    }

    mongoose.connection.close();
  } catch (error) {
    console.error('Error:', error);
    mongoose.connection.close();
  }
}

resetUserCounter();
