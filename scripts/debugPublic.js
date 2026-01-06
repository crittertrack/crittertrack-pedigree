require('dotenv').config();
const mongoose = require('mongoose');
const { PublicAnimal } = require('../database/models');

async function debugPublicAnimals() {
  try {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      console.error('MONGODB_URI not found in environment variables');
      process.exit(1);
    }

    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB\n');

    // Check total count
    const total = await PublicAnimal.countDocuments();
    console.log(`Total PublicAnimal records: ${total}\n`);

    // Try to find one
    const one = await PublicAnimal.findOne();
    console.log('Sample record:', JSON.stringify(one, null, 2));

    mongoose.connection.close();
  } catch (error) {
    console.error('Error:', error);
    mongoose.connection.close();
    process.exit(1);
  }
}

debugPublicAnimals();
