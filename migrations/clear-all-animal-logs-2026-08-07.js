// Deletes ALL AnimalLog documents across every animal (clean slate) — the timeline logger had a
// bug (before/after comparison mismatch) that polluted existing logs with phantom "changed" fields
// that never actually changed. Now that animalLogger.js/db_service.js are fixed, wipe the slate so
// old bogus entries don't linger alongside real ones.
// Run with: node migrations/clear-all-animal-logs-2026-08-07.js
require('dotenv').config();
const mongoose = require('mongoose');
const { AnimalLog } = require('../database/models');

async function main() {
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error('MONGODB_URI not found in environment variables.');
    await mongoose.connect(uri);
    console.log('Connected to MongoDB.');

    const countBefore = await AnimalLog.countDocuments({});
    console.log(`Found ${countBefore} AnimalLog document(s).`);

    const deleteResult = await AnimalLog.deleteMany({});
    console.log(`Deleted ${deleteResult.deletedCount} AnimalLog document(s).`);

    await mongoose.disconnect();
}

main().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
