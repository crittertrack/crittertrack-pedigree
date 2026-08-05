// Migrates real data from the "orphaned" (dead-in-V2-UI) fields into their current equivalents,
// then removes the legacy fields entirely from the `animals` collection. Read+verify before write.
//
// Migrated (real data preserved):
//   damFertilityStatus  -> fertilityStatus   (only where fertilityStatus is empty)
//   damFertilityNotes   -> fertilityNotes    (only where fertilityNotes is empty)
//   matingDates (String)-> lastMatingDate (Date) (only where lastMatingDate is empty)
//
// Removed with no migration needed (confirmed 0 real data, or fully dead/duplicate sub-fields):
//   lossesCount, adultWeight, whelpingDate, queeningDate (all top-level, 0 real data)
//   breedingRecords[].recordDate   (never read/written by current app; 8 docs w/ stale data)
//   breedingRecords[].litterName   (stale duplicate of Litter.breedingPairCodeName; 3 docs w/ data)
//
// NOT touched (actively used/synced, confirmed via code search):
//   breedingRecords[].lossesCount  (synced live from Litter by litterRoutes.js)
//   breedingRecords[].matingDate   (singular; the real, actively-used field)
//   lastMatingDate                (actively read/written in AnimalDetail + AnimalForm V2 components)
require('dotenv').config();
const mongoose = require('mongoose');

async function main() {
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error('MONGODB_URI not found in environment variables.');
    await mongoose.connect(uri);
    console.log('Connected to MongoDB.\n');
    const col = mongoose.connection.db.collection('animals');

    // 1. damFertilityStatus -> fertilityStatus
    const r1 = await col.updateMany(
        { damFertilityStatus: { $exists: true, $nin: [null, ''] }, $or: [{ fertilityStatus: { $exists: false } }, { fertilityStatus: null }, { fertilityStatus: '' }] },
        [{ $set: { fertilityStatus: '$damFertilityStatus' } }]
    );
    console.log(`damFertilityStatus -> fertilityStatus: migrated ${r1.modifiedCount} documents`);

    // 2. damFertilityNotes -> fertilityNotes
    const r2 = await col.updateMany(
        { damFertilityNotes: { $exists: true, $nin: [null, ''] }, $or: [{ fertilityNotes: { $exists: false } }, { fertilityNotes: null }, { fertilityNotes: '' }] },
        [{ $set: { fertilityNotes: '$damFertilityNotes' } }]
    );
    console.log(`damFertilityNotes -> fertilityNotes: migrated ${r2.modifiedCount} documents`);

    // 3. matingDates (String date) -> lastMatingDate (Date)
    const candidates = await col.find(
        { matingDates: { $exists: true, $nin: [null, ''] }, $or: [{ lastMatingDate: { $exists: false } }, { lastMatingDate: null }] }
    ).project({ matingDates: 1 }).toArray();
    let migratedMatingDates = 0;
    for (const doc of candidates) {
        const parsed = new Date(doc.matingDates);
        if (isNaN(parsed.getTime())) continue;
        await col.updateOne({ _id: doc._id }, { $set: { lastMatingDate: parsed } });
        migratedMatingDates++;
    }
    console.log(`matingDates -> lastMatingDate: migrated ${migratedMatingDates} documents`);

    // 4. Remove legacy top-level fields (data already migrated above, or confirmed 0 real data)
    const r4 = await col.updateMany(
        {},
        { $unset: {
            damFertilityStatus: '',
            damFertilityNotes: '',
            matingDates: '',
            lossesCount: '',
            adultWeight: '',
            whelpingDate: '',
            queeningDate: '',
        } }
    );
    console.log(`Removed 7 legacy top-level fields from ${r4.modifiedCount} documents (matched ${r4.matchedCount}).`);

    // 5. Remove dead sub-fields from every element of breedingRecords[]
    const r5 = await col.updateMany(
        {},
        { $unset: {
            'breedingRecords.$[].recordDate': '',
            'breedingRecords.$[].litterName': '',
        } }
    );
    console.log(`Removed breedingRecords[].recordDate/litterName from ${r5.modifiedCount} documents (matched ${r5.matchedCount}).`);

    console.log('\nDone.');
    await mongoose.disconnect();
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
