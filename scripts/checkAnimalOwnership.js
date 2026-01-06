require('dotenv').config();
const mongoose = require('mongoose');
const { Animal, User } = require('../database/models');

async function checkOwnership() {
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

    console.log('Animal Ownership Check:\n');

    for (const animalId of animalIds) {
      const animal = await Animal.findOne({ 
        id_public: animalId
      }).populate('ownerId', 'id_public personalName breederName');

      if (animal) {
        const ownerName = animal.ownerId?.id_public || animal.ownerId?.personalName || 'Unknown';
        console.log(`${animalId}: Owned by ${ownerName} (ID: ${animal.ownerId?._id})`);
      } else {
        console.log(`${animalId}: Not found`);
      }
    }

    mongoose.connection.close();
  } catch (error) {
    console.error('Error:', error);
    mongoose.connection.close();
    process.exit(1);
  }
}

checkOwnership();
