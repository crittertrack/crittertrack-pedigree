require('dotenv').config();
const mongoose = require('mongoose');
const { Animal, PublicAnimal, User } = require('../database/models');

const transferredAnimals = [
  'CTC563', 'CTC562', 'CTC522', 'CTC525', 'CTC564',
  'CTC565', 'CTC560', 'CTC561', 'CTC559', 'CTC521', 'CTC520'
];

async function main() {
  try {
    const mongoUri = process.env.MONGODB_URI;
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB\n');

    // Get CTU2 and CTU5 users
    const ctu2 = await User.findOne({ id_public: 'CTU2' });
    const ctu5 = await User.findOne({ id_public: 'CTU5' });

    console.log('=== Simulating /animals/any/:id_public endpoint behavior for CTU2 ===\n');

    for (const animalId of transferredAnimals.slice(0, 2)) { // Test first 2
      console.log(`Testing ${animalId}:`);
      
      // Step 1: Check if CTU2 owns it
      const owned = await Animal.findOne({ id_public: animalId, ownerId: ctu2._id }).lean();
      if (owned) {
        console.log(`  → Owned by CTU2, would return Animal record`);
        console.log(`    ownerId_public: ${owned.ownerId_public || 'NOT SET'}`);
        console.log(`    ownerId: ${owned.ownerId}`);
        continue;
      }
      
      // Step 2: Check if it's public
      const publicRecord = await PublicAnimal.findOne({ id_public: animalId }).lean();
      if (publicRecord) {
        console.log(`  → Not owned by CTU2, but public exists`);
        console.log(`    ownerId_public: ${publicRecord.ownerId_public || 'NOT SET'}`);
        console.log(`    Would return PublicAnimal record`);
        continue;
      }
      
      console.log(`  ✗ No record found for either owned or public`);
      console.log();
    }

    await mongoose.connection.close();
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
