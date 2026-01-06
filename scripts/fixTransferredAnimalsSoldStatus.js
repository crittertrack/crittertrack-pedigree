require('dotenv').config();
const mongoose = require('mongoose');
const { User, Animal, PublicAnimal } = require('../database/models');

async function fixSoldStatus() {
  try {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      console.error('MONGODB_URI not found in environment variables');
      process.exit(1);
    }

    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB\n');

    // Find CTU2 user
    const ctu2 = await User.findOne({ id_public: 'CTU2' });
    if (!ctu2) {
      console.error('CTU2 user not found');
      mongoose.connection.close();
      return;
    }

    const animalIds = [
      'CTC563', 'CTC562', 'CTC522', 'CTC525', 'CTC564', 'CTC565',
      'CTC560', 'CTC561', 'CTC559', 'CTC521', 'CTC520'
    ];

    console.log(`Marking ${animalIds.length} animals as sold on CTU2's end\n`);

    let successCount = 0;
    let errorCount = 0;

    for (const animalId of animalIds) {
      try {
        // Find and update animal owned by CTU2
        const animal = await Animal.findOneAndUpdate(
          { 
            id_public: animalId,
            ownerId: ctu2._id
          },
          { 
            soldStatus: 'sold',
            transferStatus: 'accepted'
          },
          { new: true }
        );

        if (animal) {
          // Update public animal record
          const publicAnimal = await PublicAnimal.findOneAndUpdate(
            { 
              animalId_public: animalId,
              ownerId: ctu2._id
            },
            { 
              soldStatus: 'sold',
              transferStatus: 'accepted'
            },
            { new: true }
          );

          console.log(`✓ Marked as sold: ${animalId} (${animal.name || 'Unnamed'})`);
          successCount++;
        } else {
          console.log(`⚠ Animal not found or not owned by CTU2: ${animalId}`);
        }
      } catch (error) {
        console.error(`✗ Error marking ${animalId} as sold: ${error.message}`);
        errorCount++;
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log('Summary:');
    console.log(`- Successfully marked as sold: ${successCount}`);
    console.log(`- Errors: ${errorCount}`);
    console.log('='.repeat(50));

    mongoose.connection.close();
  } catch (error) {
    console.error('Error:', error);
    mongoose.connection.close();
    process.exit(1);
  }
}

fixSoldStatus();
