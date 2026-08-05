// Removes 4 undeclared legacy fields found on the `publicanimals` collection during the full
// field census (careTasks/feedingFrequencyDays/lastMaintenanceDate/maintenanceFrequencyDays) —
// the exact same fields already migrated+removed from `animals` on 2026-08-05. PublicAnimalSchema
// never declared an `animalCareTasks` equivalent (care tasks aren't promoted to public profiles),
// so there is no migration target; nothing in the app reads these fields. Simple $unset.
require('dotenv').config();
const mongoose = require('mongoose');

async function main() {
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error('MONGODB_URI not found in environment variables.');
    await mongoose.connect(uri);
    console.log('Connected to MongoDB.\n');
    const col = mongoose.connection.db.collection('publicanimals');

    const r = await col.updateMany(
        {},
        { $unset: {
            careTasks: '',
            feedingFrequencyDays: '',
            lastMaintenanceDate: '',
            maintenanceFrequencyDays: '',
        } }
    );
    console.log(`Removed 4 legacy fields from ${r.modifiedCount} documents (matched ${r.matchedCount}).`);

    console.log('\nDone.');
    await mongoose.disconnect();
}

main().catch(err => { console.error(err); process.exit(1); });
