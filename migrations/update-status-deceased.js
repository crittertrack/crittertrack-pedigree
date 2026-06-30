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

const { Animal, User } = require('../database/models');

/**
 * This script archives all 'Deceased' animals for a specific user.
 */
async function archiveDeceasedAnimals() {
    console.log('--- Archive Deceased Animals Script ---');
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

    const TARGET_USER_PUBLIC_ID = 'CTU2';
    const STATUS_TO_ARCHIVE = 'Deceased';

    try {
        // --- 1. Find Target User ---
        const targetUser = await User.findOne({ id_public: TARGET_USER_PUBLIC_ID }).select('_id id_public').lean();
        if (!targetUser) {
            console.error(`❌ ERROR: Could not find target user: ${TARGET_USER_PUBLIC_ID}`);
            return; // Exit if user not found
        }
        console.log(`Found target user: ${targetUser.id_public} (_id: ${targetUser._id})\n`);

        // --- 2. Define the Query for Animals to Update ---
        const query = {
            ownerId: targetUser._id,
            status: STATUS_TO_ARCHIVE,
            archived: { $ne: true } // Only find animals that are not already archived
        };

        // --- 3. Count the animals that will be affected ---
        const count = await Animal.countDocuments(query);

        if (count === 0) {
            console.log(`✅ No unarchived animals with status '${STATUS_TO_ARCHIVE}' found for user ${TARGET_USER_PUBLIC_ID}. No action needed.`);
            return;
        }
        console.log(`Found ${count} animals to archive.\n`);

        // --- 4. Perform the update ---
        if (!IS_DRY_RUN) {
            try {
                // Bulk update Animal documents to set archived status
                const updateResult = await Animal.updateMany(query, { $set: { archived: true, isOwned: false } });

                console.log(`  -> ✅ EXECUTED: Successfully archived ${updateResult.modifiedCount} Animal documents.`);
            } catch (err) {
                console.error(`  -> ❌ FAILED to perform bulk archive:`, err.message);
            }
        } else {
            console.log(`DRY RUN: Would attempt to archive ${count} documents in the 'animals' collection.`);
        }

    } catch (error) {
        console.error('\n❌ An unexpected error occurred:', error);
    } finally {
        await mongoose.disconnect();
        console.log('✅ Disconnected from MongoDB.');
    }
}

// --- Run the script ---
archiveDeceasedAnimals();