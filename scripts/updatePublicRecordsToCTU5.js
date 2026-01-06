require('dotenv').config();
const mongoose = require('mongoose');
const { User, PublicAnimal } = require('../database/models');

const transferredAnimals = [
  'CTC563', 'CTC562', 'CTC522', 'CTC525', 'CTC564',
  'CTC565', 'CTC560', 'CTC561', 'CTC559', 'CTC521', 'CTC520'
];

async function main() {
  try {
    const mongoUri = process.env.MONGODB_URI;
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB\n');

    // Get CTU5 user
    const ctu5 = await User.findOne({ id_public: 'CTU5' });
    if (!ctu5) {
      console.error('CTU5 user not found');
      process.exit(1);
    }

    console.log(`Updating public records to CTU5 owner (${ctu5.id_public})...\n`);

    let updated = 0;
    for (const animalId of transferredAnimals) {
      const result = await PublicAnimal.updateOne(
        { id_public: animalId },
        { ownerId_public: ctu5.id_public },
        { new: true }
      );

      if (result.modifiedCount > 0) {
        console.log(`✓ ${animalId}: Updated to CTU5`);
        updated++;
      } else {
        console.log(`✗ ${animalId}: Not found or already CTU5`);
      }
    }

    console.log(`\nSummary: Updated ${updated} public records`);

    await mongoose.connection.close();
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
