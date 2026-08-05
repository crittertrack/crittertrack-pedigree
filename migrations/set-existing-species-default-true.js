// One-time migration: flips isDefault to true on all existing Species documents that
// currently have isDefault: false (grandfathers already-submitted community species into
// the default list). Does NOT change the species creation route — new species still
// default to isDefault: false going forward.
// Run with: node migrations/set-existing-species-default-true.js
require('dotenv').config();
const mongoose = require('mongoose');
const { Species } = require('../database/models');

async function main() {
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error('MONGODB_URI not found in environment variables.');
    await mongoose.connect(uri);
    console.log('Connected to MongoDB.');

    const before = await Species.countDocuments({ isDefault: false });
    console.log(`Found ${before} species with isDefault: false.`);

    const result = await Species.updateMany(
        { isDefault: false },
        { $set: { isDefault: true } }
    );
    console.log(`Updated ${result.modifiedCount} species to isDefault: true.`);

    await mongoose.disconnect();
}

main().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
