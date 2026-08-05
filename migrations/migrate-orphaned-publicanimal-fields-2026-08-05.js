// Migrates real data from legacy fields into current equivalents on the `publicanimals`
// collection, then removes the legacy fields entirely. Mirrors the same cleanup already done on
// the `animals` collection. 'Unknown' is treated as a non-informative default, not real data.
require('dotenv').config();
const mongoose = require('mongoose');

async function main() {
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error('MONGODB_URI not found in environment variables.');
    await mongoose.connect(uri);
    console.log('Connected to MongoDB.\n');
    const col = mongoose.connection.db.collection('publicanimals');

    // 1. damFertilityStatus -> fertilityStatus (only where fertilityStatus is empty/Unknown)
    const r1 = await col.updateMany(
        { damFertilityStatus: { $exists: true, $nin: [null, '', 'Unknown'] }, $or: [{ fertilityStatus: { $exists: false } }, { fertilityStatus: null }, { fertilityStatus: '' }, { fertilityStatus: 'Unknown' }] },
        [{ $set: { fertilityStatus: '$damFertilityStatus' } }]
    );
    console.log(`damFertilityStatus -> fertilityStatus: migrated ${r1.modifiedCount} documents`);

    // 2. damFertilityNotes -> fertilityNotes (0 real data expected, included for completeness/safety)
    const r2 = await col.updateMany(
        { damFertilityNotes: { $exists: true, $nin: [null, ''] }, $or: [{ fertilityNotes: { $exists: false } }, { fertilityNotes: null }, { fertilityNotes: '' }] },
        [{ $set: { fertilityNotes: '$damFertilityNotes' } }]
    );
    console.log(`damFertilityNotes -> fertilityNotes: migrated ${r2.modifiedCount} documents`);

    // 3. matingDates (Date) -> lastMatingDate (Date) - already same type here, direct copy
    const r3 = await col.updateMany(
        { matingDates: { $exists: true, $ne: null }, $or: [{ lastMatingDate: { $exists: false } }, { lastMatingDate: null }] },
        [{ $set: { lastMatingDate: '$matingDates' } }]
    );
    console.log(`matingDates -> lastMatingDate: migrated ${r3.modifiedCount} documents`);

    // 4. Remove legacy fields entirely
    const r4 = await col.updateMany(
        {},
        { $unset: { damFertilityStatus: '', damFertilityNotes: '', matingDates: '', lossesCount: '' } }
    );
    console.log(`Removed 4 legacy fields from ${r4.modifiedCount} documents (matched ${r4.matchedCount}).`);

    console.log('\nDone.');
    await mongoose.disconnect();
}

main().catch(err => { console.error(err); process.exit(1); });
