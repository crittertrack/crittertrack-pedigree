// Read-only audit for transfer-related data corruption, prompted by the return-transfer
// accept bug fixed in routes/transferRoutes.js on 2026-08-10 (see
// fix-self-referencing-return-transfers-2026-08-10.js for the self-referencing case already fixed).
// Checks for other inconsistency patterns the same bug class could have left behind.
require('dotenv').config();
const mongoose = require('mongoose');
const { Animal, AnimalTransfer, User } = require('../database/models');

(async () => {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB.\n');

    // 1. Self-referencing creatorId === originalCreatorId (the pattern already fixed — should be 0 now)
    const selfRef = await Animal.find({ $expr: { $eq: ['$creatorId', '$originalCreatorId'] } })
        .select('id_public name creatorId_public soldStatus').lean();
    console.log(`1. creatorId === originalCreatorId: ${selfRef.length}`);
    selfRef.forEach(a => console.log(`   - ${a.id_public} (${a.name}) owner=${a.creatorId_public} soldStatus=${a.soldStatus}`));

    // 2. soldStatus === 'sold' but no originalCreatorId (orphaned sold flag with no provenance)
    const orphanSold = await Animal.find({ soldStatus: 'sold', originalCreatorId: null })
        .select('id_public name creatorId_public').lean();
    console.log(`\n2. soldStatus='sold' with no originalCreatorId: ${orphanSold.length}`);
    orphanSold.forEach(a => console.log(`   - ${a.id_public} (${a.name}) owner=${a.creatorId_public}`));

    // 3. Current owner listed in their own viewOnlyForUsers (self-reference)
    // Uses aggregate (not find) — mongoose's $expr cast on find() tries to coerce field refs as literals.
    const selfViewOnly = await Animal.aggregate([
        { $match: { $expr: { $in: ['$creatorId', { $ifNull: ['$viewOnlyForUsers', []] }] } } },
        { $project: { id_public: 1, name: 1, creatorId_public: 1, viewOnlyForUsers: 1 } },
    ]);
    console.log(`\n3. creatorId present in own viewOnlyForUsers: ${selfViewOnly.length}`);
    selfViewOnly.forEach(a => console.log(`   - ${a.id_public} (${a.name}) owner=${a.creatorId_public}`));

    // 4. pendingTransferId set on the animal but the referenced transfer isn't actually pending (or doesn't exist)
    const withPending = await Animal.find({ pendingTransferId: { $ne: null } })
        .select('id_public name creatorId_public pendingTransferId').lean();
    console.log(`\n4. Animals with pendingTransferId set: ${withPending.length}`);
    for (const a of withPending) {
        const t = await AnimalTransfer.findById(a.pendingTransferId).select('status transferType').lean();
        const problem = !t ? 'TRANSFER NOT FOUND' : (t.status !== 'pending' ? `transfer status is '${t.status}', not pending` : null);
        if (problem) {
            console.log(`   - ${a.id_public} (${a.name}) owner=${a.creatorId_public} pendingTransferId=${a.pendingTransferId} -> ${problem}`);
        }
    }

    // 5. Pending AnimalTransfer records whose animal no longer references them (stale/orphaned pending transfers)
    const pendingTransfers = await AnimalTransfer.find({ status: 'pending' }).select('animalId_public fromUserId toUserId transferType').lean();
    console.log(`\n5. AnimalTransfer docs with status='pending': ${pendingTransfers.length}`);
    for (const t of pendingTransfers) {
        const animal = await Animal.findOne({ id_public: t.animalId_public }).select('id_public pendingTransferId').lean();
        if (!animal) {
            console.log(`   - transfer ${t._id} (${t.transferType}) references missing animal ${t.animalId_public}`);
        } else if (!animal.pendingTransferId || animal.pendingTransferId.toString() !== t._id.toString()) {
            console.log(`   - transfer ${t._id} (${t.transferType}) for ${t.animalId_public} is 'pending' but animal.pendingTransferId=${animal.pendingTransferId || 'null'} (mismatch/orphaned)`);
        }
    }

    // 6. originalCreatorId set but that user doesn't exist (dangling reference)
    const withOriginal = await Animal.find({ originalCreatorId: { $ne: null } })
        .select('id_public name originalCreatorId creatorId_public').lean();
    console.log(`\n6. Animals with originalCreatorId set: ${withOriginal.length} (checking each resolves to a real user)`);
    for (const a of withOriginal) {
        const u = await User.findById(a.originalCreatorId).select('id_public').lean();
        if (!u) {
            console.log(`   - ${a.id_public} (${a.name}) owner=${a.creatorId_public} originalCreatorId=${a.originalCreatorId} -> USER NOT FOUND`);
        }
    }

    console.log('\nDone.');
    await mongoose.disconnect();
})();
