require('dotenv').config();
const mongoose = require('mongoose');
const { User, Animal, PublicAnimal } = require('../database/models');

async function checkAndFixDuplicates() {
  try {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      console.error('MONGODB_URI not found in environment variables');
      process.exit(1);
    }

    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB\n');

    // Find CTU5 and CTU2 users
    const ctu5 = await User.findOne({ id_public: 'CTU5' });
    const ctu2 = await User.findOne({ id_public: 'CTU2' });
    
    if (!ctu5 || !ctu2) {
      console.error('CTU5 or CTU2 user not found');
      mongoose.connection.close();
      return;
    }

    const animalIds = [
      'CTC563', 'CTC562', 'CTC522', 'CTC525', 'CTC564', 'CTC565',
      'CTC560', 'CTC561', 'CTC559', 'CTC521', 'CTC520'
    ];

    console.log('Checking for duplicate animal records:\n');

    let duplicatesFound = 0;
    let duplicatesRemoved = 0;

    for (const animalId of animalIds) {
      // Find all versions of this animal
      const allVersions = await Animal.find({ id_public: animalId });

      if (allVersions.length > 1) {
        console.log(`⚠️  DUPLICATE FOUND: ${animalId}`);
        duplicatesFound++;

        // Keep the one owned by CTU5, remove others
        for (const animal of allVersions) {
          if (animal.ownerId.toString() !== ctu5._id.toString()) {
            console.log(`   → Removing duplicate owned by: ${animal.ownerId}`);
            
            // Remove the animal
            await Animal.deleteOne({ _id: animal._id });
            
            // Remove associated public animal records
            await PublicAnimal.deleteMany({ animalId_backend: animal._id });
            
            duplicatesRemoved++;
          }
        }
      } else {
        // Single version - verify it's owned by CTU5 and has CTU2 in view-only
        const animal = allVersions[0];
        if (animal.ownerId.toString() === ctu5._id.toString()) {
          const hasViewOnly = animal.viewOnlyForUsers && 
            animal.viewOnlyForUsers.some(uid => uid.toString() === ctu2._id.toString());
          
          if (hasViewOnly) {
            console.log(`✓ ${animalId} - Correct: Owned by CTU5, CTU2 has view-only`);
          } else {
            console.log(`⚠️  ${animalId} - Missing CTU2 view-only access`);
            await Animal.findByIdAndUpdate(
              animal._id,
              { $push: { viewOnlyForUsers: ctu2._id } },
              { new: true }
            );
            console.log(`   → Added CTU2 to view-only`);
          }
        } else {
          console.log(`✗ ${animalId} - ERROR: Not owned by CTU5`);
        }
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log('Duplicate Check Summary:');
    console.log(`- Duplicates found: ${duplicatesFound}`);
    console.log(`- Duplicates removed: ${duplicatesRemoved}`);
    console.log('='.repeat(50));

    // Verify final state
    console.log('\nFinal verification:\n');
    console.log('Animal Records:');
    
    for (const animalId of animalIds) {
      const animal = await Animal.findOne({ id_public: animalId });
      if (animal) {
        const viewOnlyCount = animal.viewOnlyForUsers?.length || 0;
        console.log(`  ${animalId}: CTU5 owner, ${viewOnlyCount} view-only user(s)`);
      }
    }

    console.log('\nPublic Animal Records (CTU5):');
    
    for (const animalId of animalIds) {
      const publicAnimal = await PublicAnimal.findOne({ 
        animalId_public: animalId,
        ownerId: ctu5._id
      });
      if (publicAnimal) {
        console.log(`  ${animalId}: ✓ Public record exists`);
      } else {
        console.log(`  ${animalId}: ✗ NO public record`);
      }
    }

    mongoose.connection.close();
  } catch (error) {
    console.error('Error:', error);
    mongoose.connection.close();
    process.exit(1);
  }
}

checkAndFixDuplicates();
