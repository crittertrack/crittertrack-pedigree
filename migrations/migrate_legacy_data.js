// This is a conceptual migration script.
// You would run this as a standalone Node.js script, NOT as part of your Express app.

const mongoose = require('mongoose');
// Adjust the path to your models.js file as necessary
const { Animal, AnimalTransfer, PublicAnimal, User } = require('./c:/Projects/crittertrack-pedigree/database/models'); 

async function runLegacyDataMigration() {
    console.log('Starting legacy data migration...');

    // --- 1. Connect to MongoDB ---
    // Ensure your MONGO_URI environment variable is set correctly for your production database
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/crittertrack_dev';
    try {
        await mongoose.connect(mongoUri, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            // Add other connection options as needed for your environment (e.g., replicaSet, authSource)
        });
        console.log('Successfully connected to MongoDB.');
    } catch (error) {
        console.error('Failed to connect to MongoDB:', error);
        process.exit(1); // Exit if connection fails
    }

    // --- 2. Migrate Animal Collection ---
    console.log('\n--- Migrating Animal collection ---');
    try {
        const animalsWithLegacyFields = await Animal.find({
            $or: [
                { pendingTransfer: { $exists: true } },
                { viewOnlyForUsers: { $exists: true } }
            ]
        });

        console.log(`Found ${animalsWithLegacyFields.length} Animal documents with legacy fields.`);

        for (const animal of animalsWithLegacyFields) {
            let updateNeeded = false;
            const updateOperations = { $unset: {}, $set: {} };

            // Handle legacy 'pendingTransfer' field
            if (animal.pendingTransfer !== undefined) {
                console.log(`  Processing Animal ${animal.id_public}: Found legacy 'pendingTransfer'.`);
                updateOperations.$unset.pendingTransfer = ""; // Remove the old field

                // Check for a corresponding active pending AnimalTransfer document
                const existingPendingTransfer = await AnimalTransfer.findOne({
                    animalId_public: animal.id_public,
                    status: 'pending'
                });

                if (existingPendingTransfer) {
                    updateOperations.$set.pendingTransferId = existingPendingTransfer._id;
                    console.log(`    -> Linked to existing pending transfer: ${existingPendingTransfer._id}`);
                } else {
                    // If no active pending transfer, ensure pendingTransferId is cleared
                    // Mongoose will unset if the value is explicitly null or undefined in $set
                    updateOperations.$set.pendingTransferId = null; 
                    console.log('    -> No active pending transfer found, clearing pendingTransferId.');
                }
                updateNeeded = true;
            }

            // Logic for viewOnlyForUsers Migration
            if (animal.viewOnlyForUsers && animal.viewOnlyForUsers.length > 0) {
                console.log(`  Processing Animal ${animal.id_public}: Found legacy 'viewOnlyForUsers' with ${animal.viewOnlyForUsers.length} entries.`);

                // Start a session for the transaction
                const session = await mongoose.startSession();
                session.startTransaction();

                try {
                    const newTransfers = [];
                    for (const viewerUserId of animal.viewOnlyForUsers) {
                        // Ensure viewerUserId is an ObjectId, if it's not already
                        const viewerUser = await User.findById(viewerUserId).select('_id').session(session);
                        if (!viewerUser) {
                            console.warn(`    -> Viewer user with ID ${viewerUserId} not found, skipping transfer creation for this viewer.`);
                            continue;
                        }

                        // Check if a similar 'view_only_grant' transfer already exists to prevent duplicates
                        const existingViewOnlyTransfer = await AnimalTransfer.findOne({
                            animalId: animal._id,
                            fromUserId: animal.ownerId,
                            toUserId: viewerUser._id,
                            type: 'view_only_grant',
                            status: 'completed',
                            isLegacyMigration: true, // Only check for legacy migrations
                        }).session(session);

                        if (existingViewOnlyTransfer) {
                            console.log(`    -> Existing 'view_only_grant' transfer found for viewer ${viewerUser._id}, skipping creation.`);
                            continue;
                        }

                        // Prepare new AnimalTransfer record for each viewer
                        newTransfers.push({
                            animalId_public: animal.id_public,
                            fromUserId: animal.ownerId, // Current owner is the sender of the view-only grant
                            toUserId: viewerUser._id, // The viewer is the receiver of the view-only grant
                            status: 'completed',
                            type: 'view_only_grant', // New type for view-only grants
                            transferDate: new Date(),
                            isLegacyMigration: true,
                            notes: 'Legacy migration from viewOnlyForUsers field.'
                        });
                    }

                    if (newTransfers.length > 0) {
                        await AnimalTransfer.insertMany(newTransfers, { session });
                        console.log(`    -> Created ${newTransfers.length} 'view_only_grant' transfers.`);
                    }

                    updateOperations.$unset.viewOnlyForUsers = ""; // Remove the old field
                    updateNeeded = true;
                    await session.commitTransaction();
                } catch (error) {
                    await session.abortTransaction();
                    console.error(`    -> Transaction failed for Animal ${animal.id_public} during viewOnlyForUsers migration:`, error);
                }
                session.endSession();
            }
            // End of viewOnlyForUsers Migration Logic

            if (updateNeeded) {
                // Remove empty $unset or $set objects if no fields were added to them
                if (Object.keys(updateOperations.$unset).length === 0) delete updateOperations.$unset;
                if (Object.keys(updateOperations.$set).length === 0) delete updateOperations.$set;

                await Animal.updateOne({ _id: animal._id }, updateOperations);
                console.log(`  -> Updated Animal ${animal.id_public} by unsetting legacy fields.`);
            } else {
                console.log(`  -> No updates needed for Animal ${animal.id_public}.`);
            }
        }
        console.log('Animal collection migration complete.');
    } catch (error) {
        console.error('Error during Animal collection migration:', error);
    }

    // --- 3. Migrate PublicAnimal Collection ---
    console.log('\n--- Migrating PublicAnimal collection ---');
    try {
        const publicAnimalsWithLegacyFields = await PublicAnimal.find({
            viewOnlyForUsers: { $exists: true }
        });

        console.log(`Found ${publicAnimalsWithLegacyFields.length} PublicAnimal documents with legacy fields.`);

        for (const publicAnimal of publicAnimalsWithLegacyFields) {
            console.log(`  Processing PublicAnimal ${publicAnimal.id_public}: Found legacy 'viewOnlyForUsers'.`);
            await PublicAnimal.updateOne({ _id: publicAnimal._id }, { $unset: { viewOnlyForUsers: "" } });
            console.log(`  -> Updated PublicAnimal ${publicAnimal.id_public}.`);
        }
        console.log('PublicAnimal collection migration complete.');
    } catch (error) {
        console.error('Error during PublicAnimal collection migration:', error);
    }

    // --- 4. Migrate AnimalTransfer Collection ---
    console.log('\n--- Migrating AnimalTransfer collection ---');
    try {
        const transfersWithLegacyFields = await AnimalTransfer.find({
            offerViewOnly: { $exists: true }
        });

        console.log(`Found ${transfersWithLegacyFields.length} AnimalTransfer documents with legacy fields.`);

        for (const transfer of transfersWithLegacyFields) {
            console.log(`  Processing AnimalTransfer ${transfer._id}: Found legacy 'offerViewOnly'.`);
            await AnimalTransfer.updateOne({ _id: transfer._id }, { $unset: { offerViewOnly: "" } });
            console.log(`  -> Updated AnimalTransfer ${transfer._id}.`);
        }
        console.log('AnimalTransfer collection migration complete.');
    } catch (error) {
        console.error('Error during AnimalTransfer collection migration:', error);
    }

    // --- 5. Disconnect from MongoDB ---
    await mongoose.disconnect();
    console.log('\nMigration finished successfully!');
}

// Execute the migration script
runLegacyDataMigration().catch(err => {
    console.error('An unhandled error occurred during migration:', err);
    process.exit(1);
});