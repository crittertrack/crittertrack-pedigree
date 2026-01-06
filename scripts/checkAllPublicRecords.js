require('dotenv').config();
const mongoose = require('mongoose');
const { PublicAnimal } = require('../database/models');

async function checkPublicAnimalRecords() {
  try {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      console.error('MONGODB_URI not found in environment variables');
      process.exit(1);
    }

    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB\n');

    const animalIds = [
      'CTC563', 'CTC562', 'CTC522', 'CTC525', 'CTC564', 'CTC565',
      'CTC560', 'CTC561', 'CTC559', 'CTC521', 'CTC520'
    ];

    console.log('Checking all PublicAnimal records for transferred animals:\n');

    for (const animalId of animalIds) {
      const records = await PublicAnimal.find({ animalId_public: animalId });
      console.log(`${animalId}: Found ${records.length} public record(s)`);
      
      records.forEach((rec, idx) => {
        console.log(`  [${idx + 1}] Owner ID: ${rec.ownerId}, Owner Public ID: ${rec.ownerId_public}`);
      });
    }

    mongoose.connection.close();
  } catch (error) {
    console.error('Error:', error);
    mongoose.connection.close();
    process.exit(1);
  }
}

checkPublicAnimalRecords();
