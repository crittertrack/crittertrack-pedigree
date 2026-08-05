// Removes the remaining confirmed-dead legacy Animal fields from every document — all were
// analyzed and found to have either zero real data, or data fully redundant with (and superseded
// by) their current-schema equivalent, so no data migration is needed here (see
// FIELDS_NOT_USED_IN_V2_UI.md for the full breakdown of each field).
// Run with: node migrations/remove-dead-legacy-animal-fields-2026-08-05.js
require('dotenv').config();
const mongoose = require('mongoose');

const DEAD_FIELDS = [
    'akcRegistrationNumber',
    'cfaRegistrationNumber',
    'fciRegistrationNumber',
    'breederyId',
    'fatherId_public',
    'motherId_public',
    'isArchived',
    'ownerName',
    'rabiesTagNumber',
    'workingRegistryIds',
    'nutritionSchedule',
    'includeGeneticCode',
    'includeRemarks',
];

async function main() {
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error('MONGODB_URI not found in environment variables.');
    await mongoose.connect(uri);
    console.log('Connected to MongoDB.\n');
    const col = mongoose.connection.db.collection('animals');

    const unset = {};
    DEAD_FIELDS.forEach(f => { unset[f] = ''; });

    const result = await col.updateMany({}, { $unset: unset });
    console.log(`Removed ${DEAD_FIELDS.length} dead legacy fields from ${result.modifiedCount} documents (matched ${result.matchedCount}).`);

    await mongoose.disconnect();
    console.log('\nDone.');
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
