/**
 * Script to remove transfer states from specific animals
 * 
 * This script:
 * 1. Clears soldStatus for the specified animals
 * 2. Deletes any AnimalTransfer records
 * 3. Removes transfer-related data
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { Animal, AnimalTransfer } = require('../database/models');

async function clearTransferStates() {
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

    // Animals to clear
    const animalIds = ['CTC522', 'CTC525'];

    console.log(`Processing ${animalIds.length} animals:\n`);
    animalIds.forEach(id => console.log(`- ${id}`));
    console.log();

    // Find animals
    const animals = await Animal.find({
      id_public: { $in: animalIds }
    });

    console.log(`Found ${animals.length} animals\n`);

    if (animals.length === 0) {
      console.log('No animals found');
      mongoose.connection.close();
      return;
    }

    // Display current state
    console.log('Current state:');
    animals.forEach((animal) => {
      console.log(`${animal.id_public}:`);
      console.log(`  - Sold Status: ${animal.soldStatus || 'None'}`);
      console.log(`  - Owner: ${animal.ownerId_public}`);
    });

    // Ask for confirmation
    console.log(`\n⚠️  About to clear transfer states from ${animals.length} animals`);
    
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

      console.log('\nClearing transfer states...\n');

      let successCount = 0;
      let errorCount = 0;

      for (const animal of animals) {
        try {
          // Clear soldStatus
          await Animal.findByIdAndUpdate(
            animal._id,
            { soldStatus: null },
            { new: true }
          );

          // Delete AnimalTransfer records
          const deletedTransfers = await AnimalTransfer.deleteMany({
            animalId_public: animal.id_public
          });

          console.log(`✓ Cleared: ${animal.id_public}`);
          if (deletedTransfers.deletedCount > 0) {
            console.log(`  - Deleted ${deletedTransfers.deletedCount} transfer record(s)`);
          }
          successCount++;
        } catch (error) {
          console.error(`✗ Failed to clear: ${animal.id_public}`);
          console.error(`  Error: ${error.message}`);
          errorCount++;
        }
      }

      // Summary
      console.log('\n' + '='.repeat(50));
      console.log('Transfer State Removal Summary:');
      console.log(`- Successfully cleared: ${successCount}`);
      console.log(`- Failed: ${errorCount}`);
      console.log(`- Total: ${successCount + errorCount}/${animals.length}`);
      console.log('='.repeat(50));

      mongoose.connection.close();
    });

  } catch (error) {
    console.error('Error during operation:', error);
    mongoose.connection.close();
    process.exit(1);
  }
}

clearTransferStates();
