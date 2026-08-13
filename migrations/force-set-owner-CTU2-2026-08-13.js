// Admin data fix: for CTC2650, CTC5477, CTC5478 — fully strip any transfer relationship and
// force current ownership to CTU2. Mirrors the "return" full-revert logic (see
// admin-ownership-transfer-system repo memory / transferRoutes.js accept route): clears
// originalCreatorId, soldStatus, viewOnlyForUsers, pendingTransferId, and cancels any pending
// AnimalTransfer records for these animals, then sets creatorId/creatorId_public to CTU2.
require('dotenv').config();
const mongoose = require('mongoose');
const { Animal, AnimalTransfer, PublicAnimal, User } = require('../database/models');

const ANIMAL_IDS = ['CTC2650', 'CTC5477', 'CTC5478'];
const TARGET_OWNER_PUBLIC_ID = 'CTU2';

(async () => {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB.\n');

    const targetOwner = await User.findOne({ id_public: TARGET_OWNER_PUBLIC_ID }).select('_id id_public');
    if (!targetOwner) {
        console.error(`Target owner ${TARGET_OWNER_PUBLIC_ID} not found. Aborting.`);
        await mongoose.disconnect();
        return;
    }

    for (const id_public of ANIMAL_IDS) {
        const animal = await Animal.findOne({ id_public });
        if (!animal) {
            console.log(`- ${id_public}: NOT FOUND, skipping.`);
            continue;
        }

        const previousOwnerId = animal.creatorId ? animal.creatorId.toString() : null;
        console.log(`- ${id_public} (${animal.name}): previousOwner=${previousOwnerId} -> ${TARGET_OWNER_PUBLIC_ID}`);

        // Cancel any still-pending transfers referencing this animal.
        const cancelled = await AnimalTransfer.updateMany(
            { animalId_public: id_public, status: 'pending' },
            { $set: { status: 'cancelled', respondedAt: new Date() } }
        );
        if (cancelled.modifiedCount > 0) {
            console.log(`  -> cancelled ${cancelled.modifiedCount} pending transfer(s).`);
        }

        animal.creatorId = targetOwner._id;
        animal.creatorId_public = targetOwner.id_public;
        animal.originalCreatorId = null;
        animal.soldStatus = null;
        animal.viewOnlyForUsers = [];
        animal.hiddenForUsers = [];
        await animal.save();
        // pendingTransferId has a sparse unique index — explicit null (rather than a missing
        // field) trips duplicate-key errors across documents, so unset it via a raw update.
        await Animal.updateOne({ _id: animal._id }, { $unset: { pendingTransferId: 1 } });

        if (animal.showOnPublicProfile) {
            await PublicAnimal.updateOne(
                { id_public },
                { $set: { creatorId_public: targetOwner.id_public } }
            );
        }

        if (previousOwnerId && previousOwnerId !== targetOwner._id.toString()) {
            await User.findByIdAndUpdate(previousOwnerId, { $pull: { ownedAnimals: animal._id } });
        }
        await User.findByIdAndUpdate(targetOwner._id, { $addToSet: { ownedAnimals: animal._id } });

        console.log('  -> fixed.\n');
    }

    console.log('Done.');
    await mongoose.disconnect();
})();
