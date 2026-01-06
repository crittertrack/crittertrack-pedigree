/**
 * Script to set up view-only access for CTU2 on migrated animals
 * 
 * This script:
 * 1. Finds all animals owned by CTU5 that came from CTU2
 * 2. Adds CTU2 to viewOnlyForUsers array
 * 3. Creates/updates PublicAnimal records for CTU2 with view-only access
 * 4. Removes CTU1's access (if applicable)
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { User, Animal, PublicAnimal } = require('../database/models');

async function setupViewOnlyAccess() {
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
    const ctu5 = await User.findOne({ id_public: 'CTU5' });
    const ctu1 = await User.findOne({ id_public: 'CTU1' });

    if (!ctu2 || !ctu5) {
      console.error('CTU2 or CTU5 user not found');
      mongoose.connection.close();
      return;
    }

    console.log('Found users:');
    console.log(`- CTU2 (Backend ID: ${ctu2._id})`);
    console.log(`- CTU5 (Backend ID: ${ctu5._id})`);
    if (ctu1) console.log(`- CTU1 (Backend ID: ${ctu1._id})`);
    console.log();

    // Find all animals currently owned by CTU5
    // We'll assume these are the ones from the migration
    const animalsOwnedByCTU5 = await Animal.find({
      ownerId: ctu5._id
    });

    console.log(`Found ${animalsOwnedByCTU5.length} animals owned by CTU5\n`);

    if (animalsOwnedByCTU5.length === 0) {
      console.log('No animals owned by CTU5');
      mongoose.connection.close();
      return;
    }

    // Display animals
    console.log('Animals to set up view-only access for:');
    animalsOwnedByCTU5.forEach((animal, idx) => {
      console.log(`${idx + 1}. ${animal.name || 'Unnamed'} (${animal.id_public})`);
      console.log(`   - Current Owner: CTU5`);
      console.log(`   - View-only users count: ${animal.viewOnlyForUsers?.length || 0}`);
    });

    // Ask for confirmation
    console.log(`\n⚠️  About to set up view-only access for CTU2 on ${animalsOwnedByCTU5.length} animals`);
    
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

      // Perform setup
      console.log('\nSetting up view-only access...\n');

      let successCount = 0;
      let errorCount = 0;

      for (const animal of animalsOwnedByCTU5) {
        try {
          // Add CTU2 to viewOnlyForUsers if not already there
          const viewOnlyUsers = animal.viewOnlyForUsers || [];
          const ctu2Already = viewOnlyUsers.some(uid => uid.toString() === ctu2._id.toString());
          
          if (!ctu2Already) {
            viewOnlyUsers.push(ctu2._id);
            await Animal.findByIdAndUpdate(
              animal._id,
              { viewOnlyForUsers: viewOnlyUsers },
              { new: true }
            );
          }

          // Get or create PublicAnimal record for CTU2
          let publicAnimal = await PublicAnimal.findOne({
            id_public: animal.id_public,
            ownerId_public: ctu2.id_public
          });

          if (!publicAnimal) {
            // Create new PublicAnimal record for CTU2
            publicAnimal = new PublicAnimal({
              ownerId_public: ctu2.id_public,
              id_public: animal.id_public,
              species: animal.species,
              prefix: animal.prefix,
              suffix: animal.suffix,
              name: animal.name,
              gender: animal.gender,
              birthDate: animal.birthDate,
              deceasedDate: animal.deceasedDate,
              status: animal.status,
              isOwned: animal.isOwned,
              isDisplay: false, // View-only animals don't display publicly
              ownerId: ctu2._id,
              animalId_backend: animal._id
            });

            await publicAnimal.save();
          }

          // Remove CTU1's public animal version if it exists
          if (ctu1) {
            const ctu1PublicAnimal = await PublicAnimal.findOne({
              id_public: animal.id_public,
              ownerId_public: ctu1.id_public
            });

            if (ctu1PublicAnimal) {
              await PublicAnimal.findByIdAndDelete(ctu1PublicAnimal._id);
              console.log(`✓ Set up view-only for CTU2: ${animal.name || 'Unnamed'} (${animal.id_public}) - Removed CTU1 access`);
            } else {
              console.log(`✓ Set up view-only for CTU2: ${animal.name || 'Unnamed'} (${animal.id_public})`);
            }
          } else {
            console.log(`✓ Set up view-only for CTU2: ${animal.name || 'Unnamed'} (${animal.id_public})`);
          }

          successCount++;
        } catch (error) {
          console.error(`✗ Failed for: ${animal.name || 'Unnamed'} (${animal.id_public})`);
          console.error(`  Error: ${error.message}`);
          errorCount++;
        }
      }

      // Summary
      console.log('\n' + '='.repeat(50));
      console.log('View-Only Access Setup Summary:');
      console.log(`- Successfully set up: ${successCount}`);
      console.log(`- Failed setups: ${errorCount}`);
      console.log(`- Total: ${successCount + errorCount}/${animalsOwnedByCTU5.length}`);
      console.log('='.repeat(50));
      console.log('\nResults:');
      console.log('- CTU2 now has view-only access to these animals');
      console.log('- CTU1 public records have been removed');

      mongoose.connection.close();
    });

  } catch (error) {
    console.error('Error during setup:', error);
    mongoose.connection.close();
    process.exit(1);
  }
}

setupViewOnlyAccess();
