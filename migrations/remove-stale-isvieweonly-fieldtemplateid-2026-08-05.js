// Migration: remove stale, undeclared, dead-code legacy fields discovered during the
// database-wide field census (2026-08-05 follow-up phase).
//
// 1. animals.isViewOnly — never declared in AnimalSchema. Confirmed dead: current code
//    only ever computes it dynamically per-viewer on .lean() response objects
//    (animalRoutes.js, db_service.js) and NEVER queries/filters by it. The persisted
//    value found on 6087/6385 docs is stale historical data with no live consumer.
// 2. species.fieldTemplateId — never declared in SpeciesSchema (field + entire FieldTemplate
//    system were intentionally fully removed in an earlier cleanup pass). 70 Species docs
//    still carry the stale leftover ObjectId reference.
//
// Both are simple $unset operations — no migration/data-copy needed since nothing reads
// either field from the raw document today.

require('dotenv').config();
const mongoose = require('mongoose');

(async () => {
    await mongoose.connect(process.env.MONGODB_URI);
    const animals = mongoose.connection.db.collection('animals');
    const species = mongoose.connection.db.collection('species');

    const beforeAnimals = await animals.countDocuments({ isViewOnly: { $exists: true } });
    const resAnimals = await animals.updateMany({ isViewOnly: { $exists: true } }, { $unset: { isViewOnly: '' } });
    console.log(`animals.isViewOnly: found on ${beforeAnimals}, unset from ${resAnimals.modifiedCount}`);

    const beforeSpecies = await species.countDocuments({ fieldTemplateId: { $exists: true } });
    const resSpecies = await species.updateMany({ fieldTemplateId: { $exists: true } }, { $unset: { fieldTemplateId: '' } });
    console.log(`species.fieldTemplateId: found on ${beforeSpecies}, unset from ${resSpecies.modifiedCount}`);

    await mongoose.disconnect();
})();
