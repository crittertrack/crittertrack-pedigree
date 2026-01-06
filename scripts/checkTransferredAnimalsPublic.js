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

    // Check PublicAnimals
    console.log('=== Checking PublicAnimal records ===\n');
    for (const animalId of transferredAnimals) {
      const publicRecord = await PublicAnimal.findOne({ id_public: animalId });
      if (publicRecord) {
        console.log(`✓ ${animalId}: Found public record (Owner: ${publicRecord.ownerId_public})`);
      } else {
        console.log(`✗ ${animalId}: NO public record`);
      }
    }

    // Check Animals
    console.log('\n=== Checking Animal records ===\n');
    for (const animalId of transferredAnimals) {
      const animals = await Animal.find({ id_public: animalId });
      console.log(`${animalId}: Found ${animals.length} Animal record(s)`);
      if (animals.length > 0) {
        animals.forEach((a, i) => {
          console.log(`  [${i}] Name: ${a.name}, Owner: ${a.ownerId}`);
        });
      }
    }

    await mongoose.connection.close();
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
