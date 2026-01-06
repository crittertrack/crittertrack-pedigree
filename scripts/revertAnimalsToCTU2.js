/**
 * Script to return specific animals to CTU2 and erase all transfer records
 * 
 * This script:
 * 1. Sets CTU2 as the sole owner
 * 2. Clears soldStatus and transfer-related fields
 * 3. Removes viewOnlyForUsers except CTU2
 * 4. Deletes all AnimalTransfer records for these animals
 * 5. Removes PublicAnimal records from other users
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { User, Animal, PublicAnimal, AnimalTransfer } = require('../database/models');

async function revertAnimals() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      console.error('MONGODB_URI not found in environment variables');
      process.exit(1);
    }

    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('✓ Connected successfully\n');

    // Find CTU2 user
    const ctu2 = await User.findOne({ id_public: 'CTU2' });
    if (!ctu2) {
      console.error('CTU2 user not found');
      mongoose.connection.close();
      return;
    }

    console.log(`Found CTU2 (Backend ID: ${ctu2._id})\n`);

    // List of animals to revert
    const animalIds = [
      'CTC521', 'CTC520', 'CTC559', 'CTC561', 'CTC560',
      'CTC565', 'CTC564', 'CTC562', 'CTC563'
    ];

    console.log(`Processing ${animalIds.length} animals:\n`);
    animalIds.forEach(id => console.log(`- ${id}`));
    console.log();

    // Find all animals
    const animals = await Animal.find({
      id_public: { $in: animalIds }
    });

    console.log(`Found ${animals.length} animals in database\n`);

    if (animals.length === 0) {
      console.log('No animals found');
      mongoose.connection.close();
      return;
    }

    // Display current state
    console.log('Current state:');
    animals.forEach((animal, idx) => {
      console.log(`${idx + 1}. ${animal.name || 'Unnamed'} (${animal.id_public})`);
      console.log(`   - Current Owner ID: ${animal.ownerId}`);
      console.log(`   - Sold Status: ${animal.soldStatus}`);
      console.log(`   - View-only users: ${animal.viewOnlyForUsers?.length || 0}`);
    });

    // Ask for confirmation
    console.log(`\n⚠️  About to revert ${animals.length} animals to CTU2 and erase ALL transfers`);
    
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    rl.question('\nProceed? (yes/no): ', async (answer) => {
      if (answer.toLowerCase() !== 'yes') {
        console.log('Operation cancelled');
        rl.close();
        mongoose.connection.close();
        return;
      }

      rl.close();

      console.log('\nReverting animals...\n');

      let successCount = 0;
      let errorCount = 0;

      for (const animal of animals) {
        try {
          // Update animal: set owner to CTU2, clear transfers, clear viewOnly except CTU2
          await Animal.findByIdAndUpdate(
            animal._id,
            {
              ownerId: ctu2._id,
              ownerId_public: ctu2.id_public,
              soldStatus: null, // Clear sold status
              viewOnlyForUsers: [ctu2._id] // Only CTU2 has view-only access
            },
            { new: true }
          );

          // Delete all AnimalTransfer records for this animal
          const deletedTransfers = await AnimalTransfer.deleteMany({
            animalId_public: animal.id_public
          });

          // Delete all PublicAnimal records except the one for CTU2
          const publicAnimals = await PublicAnimal.find({
            id_public: animal.id_public
          });

          for (const pubAnimal of publicAnimals) {
            if (pubAnimal.ownerId_public !== ctu2.id_public) {
              await PublicAnimal.findByIdAndDelete(pubAnimal._id);
            } else {
              // Update CTU2's public animal record
              await PublicAnimal.findByIdAndUpdate(
                pubAnimal._id,
                {
                  ownerId: ctu2._id,
                  isDisplay: false // Ensure it's not publicly displayed
                },
                { new: true }
              );
            }
          }

          console.log(`✓ Reverted: ${animal.name || 'Unnamed'} (${animal.id_public})`);
          console.log(`  - Deleted ${deletedTransfers.deletedCount} transfer records`);
          successCount++;
        } catch (error) {
          console.error(`✗ Failed to revert: ${animal.name || 'Unnamed'} (${animal.id_public})`);
          console.error(`  Error: ${error.message}`);
          errorCount++;
        }
      }

      // Summary
      console.log('\n' + '='.repeat(50));
      console.log('Reversion Summary:');
      console.log(`- Successfully reverted: ${successCount}`);
      console.log(`- Failed reversions: ${errorCount}`);
      console.log(`- Total: ${successCount + errorCount}/${animals.length}`);
      console.log('='.repeat(50));
      console.log('\nResults:');
      console.log('- All animals now owned by CTU2');
      console.log('- All transfer records deleted');
      console.log('- All public records from other users removed');
      console.log('- All transfer/handover data erased');

      mongoose.connection.close();
    });

  } catch (error) {
    console.error('Error during reversion:', error);
    mongoose.connection.close();
    process.exit(1);
  }
}

revertAnimals();
