/**
 * Script to verify and fix CTU2's full private access to animals
 * 
 * This script:
 * 1. Verifies CTU2 is the owner (ownerId)
 * 2. Ensures no transfer status remains
 * 3. Cleans up any view-only access that shouldn't be there
 * 4. Confirms full private detail view access
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { User, Animal } = require('../database/models');

async function verifyPrivateAccess() {
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

    // List of animals
    const animalIds = [
      'CTC521', 'CTC520', 'CTC559', 'CTC561', 'CTC560',
      'CTC565', 'CTC564', 'CTC562', 'CTC563'
    ];

    console.log(`Verifying private access for ${animalIds.length} animals:\n`);

    // Find all animals
    const animals = await Animal.find({
      id_public: { $in: animalIds }
    });

    console.log(`Found ${animals.length} animals\n`);

    // Check current state
    let needsUpdate = false;
    console.log('Current state:');
    animals.forEach((animal) => {
      const isOwned = animal.ownerId && animal.ownerId.toString() === ctu2._id.toString();
      const hasTransfers = animal.soldStatus !== null && animal.soldStatus !== undefined;
      
      console.log(`${animal.id_public}:`);
      console.log(`  - CTU2 Owner: ${isOwned ? '✓ Yes' : '✗ No'}`);
      console.log(`  - Transfer Status: ${animal.soldStatus || 'None'}`);
      console.log(`  - View-only users: ${animal.viewOnlyForUsers?.length || 0}`);
      
      if (!isOwned || hasTransfers) {
        needsUpdate = true;
      }
    });

    if (!needsUpdate) {
      console.log('\n✓ All animals are properly configured for CTU2 private access');
      mongoose.connection.close();
      return;
    }

    // Ask for confirmation to fix
    console.log(`\n⚠️  Some animals need to be fixed for full private access`);
    
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    rl.question('\nProceed with fixes? (yes/no): ', async (answer) => {
      if (answer.toLowerCase() !== 'yes') {
        console.log('Verification cancelled');
        rl.close();
        mongoose.connection.close();
        return;
      }

      rl.close();

      console.log('\nFixing private access...\n');

      let fixedCount = 0;

      for (const animal of animals) {
        try {
          // Ensure CTU2 is owner with full private access
          await Animal.findByIdAndUpdate(
            animal._id,
            {
              ownerId: ctu2._id,
              ownerId_public: ctu2.id_public,
              soldStatus: null, // Clear any transfer status
              viewOnlyForUsers: [] // Clear view-only (owner has full access)
            },
            { new: true }
          );

          console.log(`✓ Fixed: ${animal.id_public}`);
          fixedCount++;
        } catch (error) {
          console.error(`✗ Failed to fix: ${animal.id_public}`);
          console.error(`  Error: ${error.message}`);
        }
      }

      // Summary
      console.log('\n' + '='.repeat(50));
      console.log('Verification & Fix Summary:');
      console.log(`- Successfully fixed: ${fixedCount}/${animals.length}`);
      console.log('='.repeat(50));
      console.log('\nResults:');
      console.log('- CTU2 now has full ownership of all animals');
      console.log('- All animals accessible in private detail view');
      console.log('- No transfer status remains');
      console.log('- Full editing capability enabled');

      mongoose.connection.close();
    });

  } catch (error) {
    console.error('Error during verification:', error);
    mongoose.connection.close();
    process.exit(1);
  }
}

verifyPrivateAccess();
