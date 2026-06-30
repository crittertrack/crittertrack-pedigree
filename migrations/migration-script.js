const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');

// --- dotenv setup with robust path finding and debugging ---
const envPath = path.resolve(__dirname, '../.env'); // Look for .env in the project root

if (fs.existsSync(envPath)) {
    console.log(`ℹ️  Found and attempting to load .env file from: ${envPath}`);
    const dotenvResult = require('dotenv').config({ path: envPath });

    if (dotenvResult.error) {
        console.error(`❌ ERROR reading .env file at "${envPath}":`, dotenvResult.error);
    } else if (!dotenvResult.parsed || Object.keys(dotenvResult.parsed).length === 0) {
        console.warn(`⚠️  Warning: .env file found at "${envPath}" but it is empty or could not be parsed.`);
    }
} else {
    console.error(`❌ ERROR: Could not find .env file at the expected location: ${envPath}`);
}
// --- end dotenv setup ---

// --- Configuration & Setup ---
const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI; // Check for both common names
const IS_DRY_RUN = !process.argv.includes('--execute');

if (!MONGO_URI) {
    console.error('\nERROR: MONGO_URI (or MONGODB_URI) environment variable is not set.');
    if (envPath) {
        console.error(`The .env file at "${envPath}" was loaded, but it does not contain a MONGO_URI or MONGODB_URI entry.`);
    }
    console.error('Please add a MONGO_URI or MONGODB_URI entry to your .env file (e.g., MONGO_URI="mongodb://...").');
    process.exit(1);
}

// --- ------------------------------------------------------------------- ---
// --- IMPORTANT: Using actual application models.                         ---
// --- This path is based on your project structure. It assumes this       ---
// --- script is in a 'migrations' directory at the project root.          ---
// --- ------------------------------------------------------------------- ---
const { Animal, User, AnimalTransfer, PublicAnimal } = require('../database/models');


/**
 * Main function to analyze and migrate transfer-related data.
 */
async function analyzeAndMigrateData() {
    console.log('--- Database Migration & Analysis Script ---');
    if (IS_DRY_RUN) {
        console.log('RUNNING IN DRY-RUN MODE. No changes will be saved to the database.');
        console.log('To execute changes, run the script with the --execute flag: node migration-script.js --execute');
    } else {
        console.log('RUNNING IN EXECUTE MODE. Changes will be saved to the database.');
    }
    console.log('--------------------------------------------');

    try {
        await mongoose.connect(MONGO_URI);
        console.log('✅ Successfully connected to MongoDB.');
        console.log(` -> Database: '${mongoose.connection.name}'`);
    } catch (error) {
        console.error('❌ Failed to connect to MongoDB:', error.message);
        process.exit(1);
    }

    // --- Debugging: List collections ---
    try {
        const collections = await mongoose.connection.db.listCollections().toArray();
        const collectionNames = collections.map(c => c.name);
        console.log('\n--- Checking Collections ---');
        console.log('Models are looking for these collections:');
        console.log(`  - Animal:         '${Animal.collection.name}'`);
        console.log(`  - AnimalTransfer: '${AnimalTransfer.collection.name}'`);
        console.log('Available collections in the database (first 5):', collectionNames.slice(0, 5), '...');

        // Add document counts to verify if collections are empty
        if (collectionNames.includes(Animal.collection.name)) {
            const animalCount = await mongoose.connection.db.collection(Animal.collection.name).countDocuments();
            console.log(`-> Document count in '${Animal.collection.name}': ${animalCount}`);
            // Add a native findOne to see if any document can be retrieved at all
            const oneAnimal = await mongoose.connection.db.collection(Animal.collection.name).findOne();
            console.log(`-> Native findOne() result: ${oneAnimal ? 'Found at least one document.' : 'null'}`);
        }
        if (collectionNames.includes(AnimalTransfer.collection.name)) {
            const transferCount = await mongoose.connection.db.collection(AnimalTransfer.collection.name).countDocuments();
            console.log(`-> Document count in '${AnimalTransfer.collection.name}': ${transferCount}`);
        }

        console.log('--------------------------\n');
    } catch (e) {
        console.error('❌ Could not list collections or count documents:', e.message);
    }

    const report = {
        animals: { processed: 0, inconsistencies: 0, updated: 0 },
        transfers: { processed: 0, inconsistencies: 0, updatedAnimals: 0 },
        errors: [],
    };

    // --- Helper Functions ---
    const userPublicIdCache = new Map();
    const getUserPublicId = async (backendId) => {
        if (!backendId) return null;
        const cacheKey = String(backendId);
        if (userPublicIdCache.has(cacheKey)) {
            return userPublicIdCache.get(cacheKey);
        }
        try {
            const user = await User.findById(backendId).select('id_public').lean();
            const publicId = user ? user.id_public : null;
            userPublicIdCache.set(cacheKey, publicId);
            return publicId;
        } catch (err) {
            report.errors.push(`Error fetching public ID for user ${backendId}: ${err.message}`);
            return null;
        }
    };

    // --- Main Analysis Logic ---
    try {
        // For very large collections, consider using a cursor to avoid high memory usage.
        // Example: for await (const animal of Animal.find().cursor()) { ... }
        console.log('\n--- Analyzing Animal Collection ---');
        const animals = await Animal.find({});
        for (const animal of animals) {
            report.animals.processed++;
            let isModified = false;

            // Ensure viewOnlyForUsers is an array
            if (!Array.isArray(animal.viewOnlyForUsers)) {
                report.animals.inconsistencies++;
                console.log(`[Animal ${animal.id_public}] Inconsistency: 'viewOnlyForUsers' is not an array.`);
                animal.viewOnlyForUsers = [];
                isModified = true;
                console.log(`  -> FIX: Initialized 'viewOnlyForUsers' to an empty array.`);
            }

            // Scenario: soldStatus is 'sold' but originalOwnerId is missing or not in viewOnlyForUsers.
            if (animal.soldStatus === 'sold' && (!animal.originalOwnerId || !animal.viewOnlyForUsers.map(String).includes(String(animal.originalOwnerId)))) {
                report.animals.inconsistencies++;
                console.log(`[Animal ${animal.id_public}] Inconsistency: 'soldStatus' is 'sold' but 'originalOwnerId' is missing or not in 'viewOnlyForUsers'.`);
                
                const lastTransfer = await AnimalTransfer.findOne({
                    animalId_public: animal.id_public,
                    toUserId: animal.ownerId,
                    status: 'accepted',
                    offerViewOnly: { $ne: true }
                }).sort({ createdAt: -1 });

                if (lastTransfer) {
                    if (!animal.originalOwnerId) {
                        animal.originalOwnerId = lastTransfer.fromUserId;
                        isModified = true;
                        console.log(`  -> FIX: Set 'originalOwnerId' to ${lastTransfer.fromUserId} from the last transfer.`);
                    }
                    if (!animal.viewOnlyForUsers.map(String).includes(String(lastTransfer.fromUserId))) {
                        animal.viewOnlyForUsers.push(lastTransfer.fromUserId);
                        isModified = true;
                        console.log(`  -> FIX: Added 'originalOwnerId' (${lastTransfer.fromUserId}) to 'viewOnlyForUsers'.`);
                    }
                } else {
                    console.log(`  -> WARNING: No matching transfer found for sold animal ${animal.id_public}. Cannot determine original owner. Manual review needed.`);
                }
            }
            
            // Scenario: originalOwnerId present but soldStatus is not 'sold'.
            if (animal.originalOwnerId && animal.soldStatus !== 'sold') {
                report.animals.inconsistencies++;
                console.log(`[Animal ${animal.id_public}] Inconsistency: 'originalOwnerId' is present but 'soldStatus' is not 'sold'.`);
                animal.soldStatus = 'sold';
                isModified = true;
                console.log(`  -> FIX: Set 'soldStatus' to 'sold'.`);
            }

            // Scenario: isOwned flag consistency check
            const shouldBeOwned = !!animal.ownerId_public;
            if (animal.isOwned !== shouldBeOwned) {
                report.animals.inconsistencies++;
                console.log(`[Animal ${animal.id_public}] Inconsistency: 'isOwned' flag (${animal.isOwned}) is out of sync with 'ownerId_public' presence (${shouldBeOwned}).`);
                animal.isOwned = shouldBeOwned;
                isModified = true;
                console.log(`  -> FIX: Set 'isOwned' to ${shouldBeOwned}.`);
            }

            if (isModified) {
                report.animals.updated++;
                if (!IS_DRY_RUN) {
                    try {
                        await animal.save();
                        console.log(`  -> SAVED: Animal ${animal.id_public} updated.`);
                    } catch (err) {
                        report.errors.push(`Error saving Animal ${animal.id_public}: ${err.message}`);
                        console.error(`  -> ERROR: Failed to save Animal ${animal.id_public}: ${err.message}`);
                    }
                }
            }
        }

        console.log('\n--- Analyzing AnimalTransfer Collection (for accepted transfers) ---');
        const acceptedTransfers = await AnimalTransfer.find({ status: 'accepted' });
        for (const transfer of acceptedTransfers) {
            report.transfers.processed++;
            const animal = await Animal.findOne({ id_public: transfer.animalId_public });

            if (!animal) {
                report.transfers.inconsistencies++;
                console.log(`[Transfer ${transfer._id}] WARNING: Animal ${transfer.animalId_public} not found for an accepted transfer. Manual review needed.`);
                continue;
            }

            let isModified = false;

            // Standard Ownership Transfer
            if (!transfer.offerViewOnly) {
                const checks = {
                    ownerId: String(animal.ownerId) !== String(transfer.toUserId),
                    originalOwnerId: String(animal.originalOwnerId) !== String(transfer.fromUserId),
                    soldStatus: animal.soldStatus !== 'sold',
                    viewOnly: !animal.viewOnlyForUsers.map(String).includes(String(transfer.fromUserId)),
                };

                if (Object.values(checks).some(Boolean)) {
                    report.transfers.inconsistencies++;
                    console.log(`[Transfer ${transfer._id}] Inconsistency found for Animal ${animal.id_public}.`);
                    isModified = true;

                    if (checks.ownerId) {
                        animal.ownerId = transfer.toUserId;
                        animal.ownerId_public = await getUserPublicId(transfer.toUserId);
                        console.log(`  -> FIX: Owner mismatch. Setting owner to ${transfer.toUserId}.`);
                    }
                    if (checks.originalOwnerId) {
                        animal.originalOwnerId = transfer.fromUserId;
                        console.log(`  -> FIX: Original owner mismatch. Setting to ${transfer.fromUserId}.`);
                    }
                    if (checks.soldStatus) {
                        animal.soldStatus = 'sold';
                        console.log(`  -> FIX: 'soldStatus' not set. Setting to 'sold'.`);
                    }
                    if (checks.viewOnly) {
                        animal.viewOnlyForUsers.push(transfer.fromUserId);
                        console.log(`  -> FIX: Original owner missing from 'viewOnlyForUsers'. Adding ${transfer.fromUserId}.`);
                    }
                }
            } 
            // View-Only "Transfer" (e.g., old "Notify Seller")
            else {
                const checks = {
                    ownerId: String(animal.ownerId) !== String(transfer.fromUserId), // Buyer is owner
                    originalOwnerId: animal.originalOwnerId !== null,
                    soldStatus: animal.soldStatus !== null,
                    viewOnly: !animal.viewOnlyForUsers.map(String).includes(String(transfer.toUserId)), // Seller gets view access
                };

                if (Object.values(checks).some(Boolean)) {
                    report.transfers.inconsistencies++;
                    console.log(`[Transfer ${transfer._id}] Inconsistency found for Animal ${animal.id_public} (View-Only Transfer).`);
                    isModified = true;

                    if (checks.ownerId) {
                        animal.ownerId = transfer.fromUserId;
                        animal.ownerId_public = await getUserPublicId(transfer.fromUserId);
                        console.log(`  -> FIX: Owner mismatch. Setting owner to ${transfer.fromUserId}.`);
                    }
                    if (checks.originalOwnerId) {
                        animal.originalOwnerId = null;
                        console.log(`  -> FIX: 'originalOwnerId' should be null. Clearing it.`);
                    }
                    if (checks.soldStatus) {
                        animal.soldStatus = null;
                        console.log(`  -> FIX: 'soldStatus' should be null. Clearing it.`);
                    }
                    if (checks.viewOnly) {
                        animal.viewOnlyForUsers.push(transfer.toUserId);
                        console.log(`  -> FIX: View-only user missing. Adding ${transfer.toUserId}.`);
                    }
                }
            }

            if (isModified) {
                report.transfers.updatedAnimals++;
                if (!IS_DRY_RUN) {
                    try {
                        await animal.save();
                        console.log(`  -> SAVED: Animal ${animal.id_public} updated based on transfer.`);
                        
                        // Optional: Sync with PublicAnimal collection if it exists
                        const publicAnimal = await PublicAnimal.findOne({ id_public: animal.id_public });
                        if (publicAnimal) {
                            publicAnimal.ownerId_public = animal.ownerId_public;
                            publicAnimal.soldStatus = animal.soldStatus;
                            await publicAnimal.save();
                            console.log(`  -> SYNCED: PublicAnimal ${publicAnimal.id_public} updated.`);
                        }

                    } catch (err) {
                        report.errors.push(`Error saving Animal ${animal.id_public} from transfer ${transfer._id}: ${err.message}`);
                        console.error(`  -> ERROR: Failed to save Animal ${animal.id_public}: ${err.message}`);
                    }
                }
            }
        }

    } catch (error) {
        console.error('\n❌ An unexpected error occurred during analysis:', error);
        report.errors.push(`FATAL: ${error.message}`);
    } finally {
        // --- Final Report ---
        console.log('\n\n--- Migration & Analysis Complete ---');
        console.log('=====================================');
        console.log('SUMMARY:');
        console.log(`  - Animal Collection:`);
        console.log(`    - Processed: ${report.animals.processed}`);
        console.log(`    - Inconsistencies Found: ${report.animals.inconsistencies}`);
        console.log(`    - Records ${IS_DRY_RUN ? 'That Would Be Updated' : 'Updated'}: ${report.animals.updated}`);
        console.log(`  - AnimalTransfer Collection:`);
        console.log(`    - Processed (Accepted): ${report.transfers.processed}`);
        console.log(`    - Inconsistencies Found: ${report.transfers.inconsistencies}`);
        console.log(`    - Animal Records ${IS_DRY_RUN ? 'That Would Be Updated' : 'Updated'}: ${report.transfers.updatedAnimals}`);
        
        if (report.errors.length > 0) {
            console.log('\n  - Errors Encountered:');
            report.errors.forEach(err => console.log(`    - ${err}`));
        }
        console.log('=====================================');

        await mongoose.disconnect();
        console.log('✅ Disconnected from MongoDB.');
    }
}

// --- Run the script ---
analyzeAndMigrateData();
