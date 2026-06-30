const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');

// --- Environment and Configuration ---
const envPath = path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
    require('dotenv').config({ path: envPath });
}

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;
const IS_DRY_RUN = !process.argv.includes('--execute');

if (!MONGO_URI) {
    console.error('\nERROR: MONGO_URI (or MONGODB_URI) environment variable is not set.');
    process.exit(1);
}

const { Animal, User, PublicAnimal } = require('../database/models');

/**
 * This script transfers all animals with a specific prefix from a 'from' user to a 'to' user.
 * It prioritizes a "proper return" if the 'to' user is the original owner,
 * otherwise, it performs a direct transfer.
 */
async function forceReturnAnimals() {
    console.log('--- Force Return Script ---');
    if (IS_DRY_RUN) {
        console.log('RUNNING IN DRY-RUN MODE. No changes will be saved.');
        console.log('To execute changes, run with the --execute flag.\n');
    } else {
        console.log('RUNNING IN EXECUTE MODE. Changes will be saved to the database.\n');
    }

    try {
        await mongoose.connect(MONGO_URI);
        console.log(`✅ Successfully connected to MongoDB database: '${mongoose.connection.name}'`);
    } catch (error) {
        console.error('❌ Failed to connect to MongoDB:', error.message);
        process.exit(1);
    }

    const FROM_USER_PUBLIC_ID = 'CTU8';
    const TO_USER_PUBLIC_ID = 'CTU2';
    const ANIMAL_PREFIX = 'MM';

    let session;
    try {
        // --- 1. Find Users ---
        const fromUser = await User.findOne({ id_public: FROM_USER_PUBLIC_ID });
        const toUser = await User.findOne({ id_public: TO_USER_PUBLIC_ID });

        if (!fromUser || !toUser) {
            console.error(`❌ ERROR: Could not find both users. From: ${FROM_USER_PUBLIC_ID}, To: ${TO_USER_PUBLIC_ID}`);
            return;
        }
        console.log(`Found 'from' user: ${fromUser.id_public} (_id: ${fromUser._id})`);
        console.log(`Found 'to' user: ${toUser.id_public} (_id: ${toUser._id})\n`);

        // --- 2. Find Animals ---
        const animalsToTransfer = await Animal.find({
            ownerId: fromUser._id,
            prefix: ANIMAL_PREFIX
        });

        if (animalsToTransfer.length === 0) {
            console.log(`✅ No animals with prefix '${ANIMAL_PREFIX}' found for user ${FROM_USER_PUBLIC_ID}. No action needed.`);
            return;
        }
        console.log(`Found ${animalsToTransfer.length} animals with prefix '${ANIMAL_PREFIX}' owned by ${FROM_USER_PUBLIC_ID} to process.\n`);

        // --- 3. Process Each Animal ---
        for (const animal of animalsToTransfer) {
            console.log(`[Processing] Animal: ${animal.prefix} ${animal.name} (${animal.id_public})`);

            // The user's intent is that CTU2 is the original breeder for these animals.
            // We will force a "clean return" state for all animals in this batch,
            // which corrects for any past data inconsistencies where originalOwnerId might be incorrect.
            console.log(`  -> Action: Forcing clean return to original owner (${TO_USER_PUBLIC_ID}).`);
            animal.ownerId = toUser._id;
            animal.ownerId_public = toUser.id_public;
            animal.originalOwnerId = null; // Clear original owner, as it's now with the breeder.
            animal.soldStatus = null; // Clear sold status.

            // Also remove the new owner from the view-only list if they were there.
            animal.viewOnlyForUsers = (animal.viewOnlyForUsers || []).filter(
                id => String(id) !== String(toUser._id)
            );

            if (!IS_DRY_RUN) {
                session = await mongoose.startSession();
                session.startTransaction();
                try {
                    // Save the updated animal
                    await animal.save({ session });

                    // Update the corresponding PublicAnimal document if it exists
                    await PublicAnimal.updateOne(
                        { id_public: animal.id_public },
                        { $set: { ownerId_public: toUser.id_public, soldStatus: animal.soldStatus } },
                        { session }
                    );

                    // Update the `ownedAnimals` array on both user documents
                    await User.updateOne({ _id: fromUser._id }, { $pull: { ownedAnimals: animal._id } }, { session });
                    await User.updateOne({ _id: toUser._id }, { $addToSet: { ownedAnimals: animal._id } }, { session });
                    
                    await session.commitTransaction();
                    console.log(`  -> ✅ EXECUTED: Successfully transferred animal.`);
                } catch (err) {
                    console.error(`  -> ❌ FAILED to transfer animal ${animal.id_public}:`, err.message);
                    await session.abortTransaction();
                } finally {
                    session.endSession();
                }
            }
        }
        console.log(`\nScript finished processing ${animalsToTransfer.length} animals.`);

    } catch (error) {
        console.error('\n❌ An unexpected error occurred:', error);
    } finally {
        await mongoose.disconnect();
        console.log('✅ Disconnected from MongoDB.');
    }
}

// --- Run the script ---
forceReturnAnimals();
