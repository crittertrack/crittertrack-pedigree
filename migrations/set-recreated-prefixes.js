// Sets the prefix on the remaining 4 recreated parent placeholders to match their
// offspring's line code, as a starting point for manual backfill (name/details still
// need to be filled in by the owner).
// Run with: node migrations/set-recreated-prefixes.js
require('dotenv').config();
const mongoose = require('mongoose');
const { Animal } = require('../database/models');

const PREFIXES = {
    CTC1622: 'NLB',
    CTC1722: 'NLB',
    CTC4620: 'TBS',
    CTC4616: 'TBS',
};

async function main() {
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error('MONGODB_URI not found in environment variables.');
    await mongoose.connect(uri);
    console.log('Connected to MongoDB.');

    for (const [id, prefix] of Object.entries(PREFIXES)) {
        const result = await Animal.updateOne({ id_public: id }, { $set: { prefix } });
        console.log(`${id}: matched=${result.matchedCount}, modified=${result.modifiedCount}, prefix="${prefix}"`);
    }

    await mongoose.disconnect();
}

main().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
