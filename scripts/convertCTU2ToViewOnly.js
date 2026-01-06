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
    
    if (!ctu2 || !ctu5) {
      console.error('CTU2 or CTU5 user not found');
      process.exit(1);
    }

    console.log(`Converting CTU2's versions to view-only...\n`);

    let updated = 0;
    for (const animalId of transferredAnimals) {
      // Find CTU2's version of this animal
      const animal = await Animal.findOne({ 
        id_public: animalId, 
        ownerId: ctu2._id 
      });

      if (animal) {
        // Change ownership to CTU5 and add CTU2 to view-only
        animal.ownerId = ctu5._id;
        
        // Add CTU2 to viewOnlyForUsers if not already there
        if (!animal.viewOnlyForUsers.includes(ctu2._id)) {
          animal.viewOnlyForUsers.push(ctu2._id);
        }
        
        await animal.save();
        console.log(`✓ ${animalId} (${animal.name}): Changed CTU2 from owner to view-only`);
        updated++;
      } else {
        // Check if CTU5 version exists
        const ctu5Version = await Animal.findOne({ 
          id_public: animalId, 
          ownerId: ctu5._id 
        });
        if (ctu5Version) {
          console.log(`ℹ ${animalId} (${ctu5Version.name}): Only CTU5 version exists (already view-only for CTU2)`);
        } else {
          console.log(`✗ ${animalId}: No record found for either user`);
        }
      }
    }

    console.log(`\nSummary: Updated ${updated} CTU2 records to view-only`);

    await mongoose.connection.close();
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
