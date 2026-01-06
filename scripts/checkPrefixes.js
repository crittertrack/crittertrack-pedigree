require('dotenv').config();
const mongoose = require('mongoose');
const { Animal, PublicAnimal } = require('../database/models');

const transferredAnimals = [
  'CTC563', 'CTC562', 'CTC522', 'CTC525', 'CTC564',
  'CTC565', 'CTC560', 'CTC561', 'CTC559', 'CTC521', 'CTC520'
];

async function main() {
  try {
    const mongoUri = process.env.MONGODB_URI;
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB\n');

    console.log('=== Checking prefix sync between Animal and PublicAnimal ===\n');

    for (const animalId of transferredAnimals) {
      const animal = await Animal.findOne({ id_public: animalId }).lean();
      const publicAnimal = await PublicAnimal.findOne({ id_public: animalId }).lean();

      console.log(`${animalId}:`);
      console.log(`  Animal prefix: "${animal?.prefix || '(empty)'}"`);
      console.log(`  PublicAnimal prefix: "${publicAnimal?.prefix || '(empty)'}"`);
      
      // Check if they match
      if (animal?.prefix !== publicAnimal?.prefix) {
        console.log(`  ⚠️  MISMATCH - needs update`);
      }
      console.log();
    }

    await mongoose.connection.close();
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
