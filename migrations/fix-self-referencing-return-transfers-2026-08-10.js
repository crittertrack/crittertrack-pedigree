// One-off fix for the return-transfer accept bug (fixed in routes/transferRoutes.js on 2026-08-10):
// accepting a "return to original breeder" transfer never cleared originalCreatorId/soldStatus,
// leaving animals where creatorId === originalCreatorId (self-referencing) even though the owner
// has full, un-transferred ownership again. This clears that leftover state and removes both the
// current owner and the identified returner from viewOnlyForUsers, since no transfer relationship
// remains after a completed return.
require('dotenv').config();
const mongoose = require('mongoose');
const { Animal, AnimalTransfer, User } = require('../database/models');

(async () => {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB.\n');

    const corrupted = await Animal.find({
        $expr: { $eq: ['$creatorId', '$originalCreatorId'] },
    });
    console.log(`Found ${corrupted.length} animal(s) with creatorId === originalCreatorId.\n`);

    for (const animal of corrupted) {
        const owner = await User.findById(animal.creatorId).select('id_public').lean();
        console.log(`- ${animal.id_public} (${animal.name}) owner=${owner?.id_public || animal.creatorId} soldStatus=${animal.soldStatus}`);

        // Identify the returner from the most recent accepted "return" transfer for this animal,
        // so they can be removed from viewOnlyForUsers along with the owner.
        const returnTransfer = await AnimalTransfer.findOne({
            animalId_public: animal.id_public,
            transferType: 'return',
            status: 'accepted',
        }).sort({ completedAt: -1 });

        const idsToRemove = [animal.creatorId.toString()];
        if (returnTransfer) {
            idsToRemove.push(returnTransfer.fromUserId.toString());
            console.log(`  -> returner identified from transfer ${returnTransfer._id}: ${returnTransfer.fromUserId}`);
        } else {
            console.log('  -> no matching accepted return transfer found; only removing current owner from viewOnlyForUsers');
        }

        animal.originalCreatorId = null;
        animal.soldStatus = null;
        animal.viewOnlyForUsers = (animal.viewOnlyForUsers || []).filter(
            uid => !idsToRemove.includes(uid.toString())
        );
        await animal.save();
        console.log('  -> fixed.\n');
    }

    console.log('Done.');
    await mongoose.disconnect();
})();
