// Reverts the CTC5223 recreation: deletes the placeholder Animal record and nulls out
// sireId_public on every animal/litter that referenced it (not owned by CTU1, so it
// can't be identified/backfilled).
// Run with: node migrations/remove-ctc5223.js
require('dotenv').config();
const mongoose = require('mongoose');
const { Animal, Litter } = require('../database/models');

const TARGET_ID = 'CTC5223';

async function main() {
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error('MONGODB_URI not found in environment variables.');
    await mongoose.connect(uri);
    console.log('Connected to MongoDB.');

    const deleteResult = await Animal.deleteOne({ id_public: TARGET_ID });
    console.log(`Deleted ${deleteResult.deletedCount} animal record for ${TARGET_ID}.`);

    const animalUpdate = await Animal.updateMany(
        { sireId_public: TARGET_ID },
        { $set: { sireId_public: null } }
    );
    console.log(`Cleared sireId_public on ${animalUpdate.modifiedCount} offspring animal(s).`);

    const litterUpdate = await Litter.updateMany(
        { sireId_public: TARGET_ID },
        { $set: { sireId_public: null } }
    );
    console.log(`Cleared sireId_public on ${litterUpdate.modifiedCount} litter record(s).`);

    await mongoose.disconnect();
}

main().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
