/**
 * Script to auto-accept pending animal transfers for CTU5
 * 
 * This script:
 * 1. Finds all pending transfers TO CTU5
 * 2. Auto-accepts them (sets status to 'accepted')
 * 3. Updates animal records:
 *    - Mark as 'purchased' for full ownership transfers
 *    - Mark CTU2 as view-only if not already
 *    - Mark originator (sender) as sold
 * 4. Creates/updates PublicAnimal records
 * 5. Ensures transfer icons and status display correctly
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { User, Animal, PublicAnimal, AnimalTransfer } = require('../database/models');

async function autoAcceptTransfers() {
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

    // Find CTU5 user
    const ctu5 = await User.findOne({ id_public: 'CTU5' });
    if (!ctu5) {
      console.error('CTU5 user not found');
      mongoose.connection.close();
      return;
    }

    // Find CTU2 user (for view-only access setup)
    const ctu2 = await User.findOne({ id_public: 'CTU2' });
    if (!ctu2) {
      console.error('CTU2 user not found');
      mongoose.connection.close();
      return;
    }

    console.log(`Found CTU5 (Backend ID: ${ctu5._id})`);
    console.log(`Found CTU2 (Backend ID: ${ctu2._id})\n`);

    // Find all pending transfers TO CTU5
    const pendingTransfers = await AnimalTransfer.find({
      toUserId: ctu5._id,
      status: 'pending'
    }).populate('fromUserId', 'id_public personalName breederName');

    console.log(`Found ${pendingTransfers.length} pending transfers to CTU5\n`);

    if (pendingTransfers.length === 0) {
      console.log('No pending transfers to accept');
      mongoose.connection.close();
      return;
    }

    // Display transfers
    console.log('Pending transfers to accept:');
    pendingTransfers.forEach((transfer, idx) => {
      const fromUserName = transfer.fromUserId?.personalName || transfer.fromUserId?.breederName || transfer.fromUserId?.id_public || 'Unknown';
      console.log(`${idx + 1}. Animal ${transfer.animalId_public} from ${fromUserName}`);
      console.log(`   - Transfer Type: ${transfer.transferType}`);
      console.log(`   - View Only: ${transfer.offerViewOnly}`);
      console.log(`   - Created: ${new Date(transfer.createdAt).toLocaleDateString()}`);
    });

    // Ask for confirmation
    console.log(`\n⚠️  About to accept ${pendingTransfers.length} pending transfers for CTU5`);
    console.log('This will:');
    console.log('- Accept all transfers and mark as completed');
    console.log('- Mark animals as "purchased" for full ownership transfers');
    console.log('- Add CTU2 to view-only access if applicable');
    console.log('- Ensure transfer icons display correctly\n');
    
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    rl.question('Proceed with accepting transfers? (yes/no): ', async (answer) => {
      if (answer.toLowerCase() !== 'yes') {
        console.log('Operation cancelled');
        rl.close();
        mongoose.connection.close();
        return;
      }

      rl.close();

      // Perform acceptance
      console.log('\nAccepting transfers...\n');

      let successCount = 0;
      let errorCount = 0;

      for (const transfer of pendingTransfers) {
        try {
          // Accept the transfer
          const updatedTransfer = await AnimalTransfer.findByIdAndUpdate(
            transfer._id,
            {
              status: 'accepted',
              completedAt: new Date()
            },
            { new: true }
          );

          // Get the animal to update
          const animal = await Animal.findOne({ id_public: transfer.animalId_public });
          if (animal) {
            // Update animal based on transfer type
            if (!transfer.offerViewOnly) {
              // Full ownership transfer - mark as purchased (on CTU5's end)
              await Animal.findByIdAndUpdate(
                animal._id,
                { 
                  soldStatus: 'purchased',
                  // Mark transfer was accepted (for icons/status display)
                  transferStatus: 'accepted'
                },
                { new: true }
              );

              // ALSO mark as SOLD on the originating owner's end (CTU2)
              // Find if there's a copy owned by the sender
              const senderAnimal = await Animal.findOne({
                id_public: transfer.animalId_public,
                ownerId: transfer.fromUserId
              });
              if (senderAnimal) {
                await Animal.findByIdAndUpdate(
                  senderAnimal._id,
                  { 
                    soldStatus: 'sold',
                    transferStatus: 'accepted'
                  },
                  { new: true }
                );

                // Update sender's public animal record
                const senderPublicAnimal = await PublicAnimal.findOne({ 
                  animalId_public: transfer.animalId_public,
                  ownerId: transfer.fromUserId
                });
                if (senderPublicAnimal) {
                  await PublicAnimal.findByIdAndUpdate(
                    senderPublicAnimal._id,
                    { 
                      soldStatus: 'sold',
                      transferStatus: 'accepted'
                    },
                    { new: true }
                  );
                }
              }

              // Add CTU2 to view-only users if they were the sender and not already in view-only
              if (transfer.fromUserId.toString() === ctu2._id.toString()) {
                const viewOnlyUsers = animal.viewOnlyForUsers || [];
                const ctu2Already = viewOnlyUsers.some(uid => uid.toString() === ctu2._id.toString());
                
                if (!ctu2Already) {
                  await Animal.findByIdAndUpdate(
                    animal._id,
                    { 
                      $push: { viewOnlyForUsers: ctu2._id }
                    },
                    { new: true }
                  );
                }
              }

              // Update public animal record
              const publicAnimal = await PublicAnimal.findOne({ animalId_public: transfer.animalId_public });
              if (publicAnimal) {
                await PublicAnimal.findByIdAndUpdate(
                  publicAnimal._id,
                  { 
                    soldStatus: 'purchased',
                    transferStatus: 'accepted'
                  },
                  { new: true }
                );
              } else {
                // Create public animal record if it doesn't exist
                await PublicAnimal.create({
                  animalId_public: transfer.animalId_public,
                  id_public: transfer.animalId_public,
                  animalId_backend: animal._id,
                  ownerId: ctu5._id,
                  ownerId_public: ctu5.id_public,
                  name: animal.name,
                  species: animal.species,
                  gender: animal.gender,
                  birthDate: animal.birthDate,
                  soldStatus: 'purchased',
                  transferStatus: 'accepted',
                  sectionPrivacy: animal.sectionPrivacy || {}
                });
              }
            } else {
              // View-only transfer - mark accordingly
              await Animal.findByIdAndUpdate(
                animal._id,
                { 
                  transferStatus: 'accepted'
                },
                { new: true }
              );

              // Update public animal record for view-only access
              const publicAnimal = await PublicAnimal.findOne({ animalId_public: transfer.animalId_public });
              if (publicAnimal) {
                await PublicAnimal.findByIdAndUpdate(
                  publicAnimal._id,
                  { 
                    transferStatus: 'accepted'
                  },
                  { new: true }
                );
              }
            }
          }

          const fromUserName = transfer.fromUserId?.personalName || transfer.fromUserId?.breederName || transfer.fromUserId?.id_public || 'Unknown';
          console.log(`✓ Accepted: ${transfer.animalId_public} from ${fromUserName}`);
          if (!transfer.offerViewOnly) {
            console.log(`  → Marked as purchased (full ownership)`);
          }
          if (transfer.fromUserId.toString() === ctu2._id.toString()) {
            console.log(`  → CTU2 added to view-only access`);
          }
          successCount++;
        } catch (error) {
          console.error(`✗ Failed to accept: ${transfer.animalId_public}`);
          console.error(`  Error: ${error.message}`);
          errorCount++;
        }
      }

      // Summary
      console.log('\n' + '='.repeat(50));
      console.log('Transfer Acceptance Summary:');
      console.log(`- Successfully accepted: ${successCount}`);
      console.log(`- Failed acceptances: ${errorCount}`);
      console.log(`- Total: ${successCount + errorCount}/${pendingTransfers.length}`);
      console.log('='.repeat(50));

      mongoose.connection.close();
    });

  } catch (error) {
    console.error('Error during transfer acceptance:', error);
    mongoose.connection.close();
    process.exit(1);
  }
}

autoAcceptTransfers();
