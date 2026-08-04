// Un-archives the 5 parent placeholders created by recreate-orphaned-parents.js so they
// show up in CTU1's normal animal list instead of only the Archive screen.
// Run with: node migrations/unarchive-recreated-parents.js
require('dotenv').config();
const mongoose = require('mongoose');
const { Animal } = require('../database/models');

const RECREATED_IDS = ['CTC1622', 'CTC1722', 'CTC5223', 'CTC4620', 'CTC4616'];

async function main() {
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error('MONGODB_URI not found in environment variables.');
    await mongoose.connect(uri);
    console.log('Connected to MongoDB.');

    const result = await Animal.updateMany(
        { id_public: { $in: RECREATED_IDS } },
        { $set: { archived: false } }
    );
    console.log(`Un-archived ${result.modifiedCount} animal(s).`);

    await mongoose.disconnect();
}

main().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
