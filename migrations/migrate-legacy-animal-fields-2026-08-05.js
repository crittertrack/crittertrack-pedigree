// Migrates real legacy-field data on Animal documents into their current-schema equivalents,
// then removes the legacy fields from every document. Read the analysis notes in
// FIELDS_NOT_USED_IN_V2_UI.md before re-running / adapting this for other fields.
// Run with: node migrations/migrate-legacy-animal-fields-2026-08-05.js
require('dotenv').config();
const mongoose = require('mongoose');

async function main() {
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error('MONGODB_URI not found in environment variables.');
    await mongoose.connect(uri);
    console.log('Connected to MongoDB.\n');
    const col = mongoose.connection.db.collection('animals');

    // 1. manualOwnerName -> manualownerName (casing fix, straight copy)
    let manualOwnerCount = 0;
    const manualOwnerCursor = col.find({
        manualOwnerName: { $exists: true, $nin: [null, ''] },
        $or: [{ manualownerName: { $exists: false } }, { manualownerName: null }, { manualownerName: '' }],
    });
    for await (const doc of manualOwnerCursor) {
        await col.updateOne({ _id: doc._id }, { $set: { manualownerName: doc.manualOwnerName } });
        manualOwnerCount++;
    }
    console.log(`manualOwnerName -> manualownerName: migrated ${manualOwnerCount} documents`);

    // 2. feedingFrequencyDays -> feedingIntervalHours (unit conversion: days * 24 = hours)
    let feedingCount = 0;
    const feedingCursor = col.find({
        feedingFrequencyDays: { $exists: true, $ne: null },
        $or: [{ feedingIntervalHours: { $exists: false } }, { feedingIntervalHours: null }],
    });
    for await (const doc of feedingCursor) {
        await col.updateOne({ _id: doc._id }, { $set: { feedingIntervalHours: doc.feedingFrequencyDays * 24 } });
        feedingCount++;
    }
    console.log(`feedingFrequencyDays -> feedingIntervalHours: migrated ${feedingCount} documents`);

    // 3. careTasks[] -> animalCareTasks[] (reshape into current subdocument shape)
    let careTasksCount = 0;
    const careTasksDocIds = new Set();
    const careTasksCursor = col.find({ careTasks: { $exists: true, $not: { $size: 0 } } });
    for await (const doc of careTasksCursor) {
        const existing = Array.isArray(doc.animalCareTasks) ? doc.animalCareTasks : [];
        const migrated = (doc.careTasks || []).map(t => ({
            id: t._id ? String(t._id) : Date.now().toString(),
            taskName: t.taskName,
            notes: t.notes || null,
            lastDoneDate: t.lastDoneDate || null,
            frequencyDays: t.frequencyDays ?? null,
            lastSkipped: t.lastSkipped || false,
        }));
        await col.updateOne({ _id: doc._id }, { $set: { animalCareTasks: [...existing, ...migrated] } });
        careTasksDocIds.add(String(doc._id));
        careTasksCount++;
    }
    console.log(`careTasks -> animalCareTasks: migrated ${careTasksCount} documents`);

    // 4. lastMaintenanceDate + maintenanceFrequencyDays -> synthesized "Maintenance" animalCareTasks[]
    // entry. Skipped for documents already migrated in step 3 above (their careTasks[] entry
    // already represents the same underlying task — avoids creating a redundant duplicate).
    let maintCount = 0;
    let maintSkipped = 0;
    const maintCursor = col.find({
        $or: [{ lastMaintenanceDate: { $exists: true, $ne: null } }, { maintenanceFrequencyDays: { $exists: true, $ne: null } }],
    });
    for await (const doc of maintCursor) {
        if (careTasksDocIds.has(String(doc._id))) {
            maintSkipped++;
            continue;
        }
        const existing = Array.isArray(doc.animalCareTasks) ? doc.animalCareTasks : [];
        const task = {
            id: `${Date.now()}${Math.random().toString(36).slice(2, 6)}`,
            taskName: 'Maintenance',
            notes: null,
            lastDoneDate: doc.lastMaintenanceDate || null,
            frequencyDays: doc.maintenanceFrequencyDays ?? null,
            lastSkipped: false,
        };
        await col.updateOne({ _id: doc._id }, { $set: { animalCareTasks: [...existing, task] } });
        maintCount++;
    }
    console.log(`lastMaintenanceDate/maintenanceFrequencyDays -> animalCareTasks: migrated ${maintCount} documents (${maintSkipped} skipped, already covered by careTasks migration)`);

    // 5. Remove the legacy fields entirely from every document.
    const unsetResult = await col.updateMany({}, {
        $unset: {
            manualOwnerName: '',
            feedingFrequencyDays: '',
            careTasks: '',
            lastMaintenanceDate: '',
            maintenanceFrequencyDays: '',
        },
    });
    console.log(`\nRemoved legacy fields from ${unsetResult.modifiedCount} documents (matched ${unsetResult.matchedCount}).`);

    await mongoose.disconnect();
    console.log('\nDone.');
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
