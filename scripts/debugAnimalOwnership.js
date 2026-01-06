require('dotenv').config();
const mongoose = require('mongoose');
const { User, Animal } = require('../database/models');

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

    for (const animalId of transferredAnimals) {
      const allRecords = await Animal.find({ id_public: animalId });
      console.log(`\n${animalId}:`);
      console.log(`  Total records: ${allRecords.length}`);
      
      allRecords.forEach((record, i) => {
        const ownerName = record.ownerId.toString() === ctu2._id.toString() ? 'CTU2' : 
                         record.ownerId.toString() === ctu5._id.toString() ? 'CTU5' : 'OTHER';
        console.log(`  [${i}] Owner: ${ownerName} (${record.ownerId})`);
        console.log(`      ViewOnly: ${record.viewOnlyForUsers.map(id => 
          id.toString() === ctu2._id.toString() ? 'CTU2' :
          id.toString() === ctu5._id.toString() ? 'CTU5' : 'OTHER'
        ).join(', ') || 'none'}`);
      });
    }

    await mongoose.connection.close();
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
