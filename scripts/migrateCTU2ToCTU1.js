/**
 * Migration Script: Move animals from CTU2 to CTU1
 * 
 * Restrictions:
 * 1. Only animals that are NOT checked as owned (isOwned === false)
 * 2. NO animals that are sold/view-only (soldStatus === null)
 * 3. NO animals with "Available" status (status !== 'Available')
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { User, Animal, PublicAnimal } = require('../database/models');

async function migrateAnimals() {
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

    // Find users
    const ctu2 = await User.findOne({ id_public: 'CTU2' });
    const ctu1 = await User.findOne({ id_public: 'CTU1' });

    if (!ctu2) {
      console.error('CTU2 user not found');
      mongoose.connection.close();
      return;
    }

    if (!ctu1) {
      console.error('CTU1 user not found');
      mongoose.connection.close();
      return;
    }

    console.log('Found users:');
    console.log(`- CTU2 (Backend ID: ${ctu2._id})`);
    console.log(`- CTU1 (Backend ID: ${ctu1._id})\n`);

    // Build query with all restrictions
    // 1. Owned by CTU2
    // 2. isOwned === false (NOT checked as owned)
    // 3. soldStatus === null (NOT sold/view-only)
    // 4. status !== 'Available' (NO available status)
    const query = {
      ownerId: ctu2._id,
      isOwned: false,
      soldStatus: null,
      status: { $ne: 'Available' }
    };

    console.log('Query criteria:');
    console.log('- ownerId: CTU2');
    console.log('- isOwned: false (NOT checked as owned)');
    console.log('- soldStatus: null (NOT sold/view-only)');
    console.log('- status: NOT "Available"\n');

    // Find matching animals
    const animalsToMigrate = await Animal.find(query);

    console.log(`Found ${animalsToMigrate.length} animals matching criteria\n`);

    if (animalsToMigrate.length === 0) {
      console.log('No animals to migrate');
      mongoose.connection.close();
      return;
    }

    // Display animals before migration
    console.log('Animals to migrate:');
    animalsToMigrate.forEach((animal, idx) => {
      console.log(`${idx + 1}. ${animal.name || 'Unnamed'} (${animal.id_public})`);
      console.log(`   - Status: ${animal.status}`);
      console.log(`   - isOwned: ${animal.isOwned}`);
      console.log(`   - soldStatus: ${animal.soldStatus}`);
    });

    // Ask for confirmation
    console.log(`\n⚠️  About to migrate ${animalsToMigrate.length} animals from CTU2 to CTU1`);
    
    // For automation, you can change this to auto-proceed
    // Remove the readline if running in automated environment
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    rl.question('\nProceed with migration? (yes/no): ', async (answer) => {
      if (answer.toLowerCase() !== 'yes') {
        console.log('Migration cancelled');
        rl.close();
        mongoose.connection.close();
        return;
      }

      rl.close();

      // Perform migration
      console.log('\nStarting migration...\n');

      let successCount = 0;
      let errorCount = 0;

      for (const animal of animalsToMigrate) {
        try {
          // Update animal owner
          await Animal.findByIdAndUpdate(
            animal._id,
            { ownerId: ctu1._id },
            { new: true }
          );

          // Update public animal owner if it exists
          const publicAnimal = await PublicAnimal.findOne({ animalId_backend: animal._id });
          if (publicAnimal) {
            await PublicAnimal.findByIdAndUpdate(
              publicAnimal._id,
              { ownerId: ctu1._id },
              { new: true }
            );
          }

          console.log(`✓ Migrated: ${animal.name || 'Unnamed'} (${animal.id_public})`);
          successCount++;
        } catch (error) {
          console.error(`✗ Failed to migrate: ${animal.name || 'Unnamed'} (${animal.id_public})`);
          console.error(`  Error: ${error.message}`);
          errorCount++;
        }
      }

      // Summary
      console.log('\n' + '='.repeat(50));
      console.log('Migration Summary:');
      console.log(`- Successfully migrated: ${successCount}`);
      console.log(`- Failed migrations: ${errorCount}`);
      console.log(`- Total: ${successCount + errorCount}/${animalsToMigrate.length}`);
      console.log('='.repeat(50));

      mongoose.connection.close();
    });

  } catch (error) {
    console.error('Error during migration:', error);
    mongoose.connection.close();
    process.exit(1);
  }
}

migrateAnimals();
