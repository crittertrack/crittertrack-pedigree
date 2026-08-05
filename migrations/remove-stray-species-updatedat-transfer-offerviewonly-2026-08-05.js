// Migration: remove remaining stray/stale undeclared fields found on the final
// verification pass of the database-wide field census (2026-08-05).
//
// 1. species.updatedAt — SpeciesSchema has never had `{ timestamps: true }` (only a manual
//    `createdAt` field is declared) and no current write path sets it. Only 7/87 Species
//    docs carry it — stale leftover from an old schema/version, not written by anything today.
// 2. animaltransfers.offerViewOnly — AnimalTransferSchema never declares it. Confirmed dead:
//    the only write site (budgetRoutes.js) has just been removed as vestigial, and the
//    `type: 'view_only_grant'` enum option it was meant to pair with is never set anywhere
//    either. The actual "grant previous owner view access after a sale" behavior happens
//    unconditionally in transferRoutes.js's /accept handler, independent of this flag.

require('dotenv').config();
const mongoose = require('mongoose');

(async () => {
    await mongoose.connect(process.env.MONGODB_URI);
    const species = mongoose.connection.db.collection('species');
    const transfers = mongoose.connection.db.collection('animaltransfers');

    const beforeSpecies = await species.countDocuments({ updatedAt: { $exists: true } });
    const resSpecies = await species.updateMany({ updatedAt: { $exists: true } }, { $unset: { updatedAt: '' } });
    console.log(`species.updatedAt: found on ${beforeSpecies}, unset from ${resSpecies.modifiedCount}`);

    const beforeTransfers = await transfers.countDocuments({ offerViewOnly: { $exists: true } });
    const resTransfers = await transfers.updateMany({ offerViewOnly: { $exists: true } }, { $unset: { offerViewOnly: '' } });
    console.log(`animaltransfers.offerViewOnly: found on ${beforeTransfers}, unset from ${resTransfers.modifiedCount}`);

    await mongoose.disconnect();
})();
