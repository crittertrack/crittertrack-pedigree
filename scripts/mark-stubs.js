// scripts/mark-stubs.js
require('dotenv').config();
const mongoose = require('mongoose');
const { Animal } = require('../database/models');

async function run() {
    const uri = process.env.MONGODB_URI;
    if (!uri) { console.error('MONGODB_URI not set'); process.exit(1); }
    await mongoose.connect(uri);
    // Heuristic: stubs have no image, no color, no birthDate, and name like 'SimpleBreed #' or similar
    const result = await Animal.updateMany(
        {
            isStub: { $ne: true },
            $or: [
                { name: /SimpleBreed #/ },
                { color: null },
                { imageUrl: null },
                { birthDate: null }
            ]
        },
        { $set: { isStub: true } }
    );
    console.log(`Marked ${result.modifiedCount} animals as stubs.`);
    await mongoose.disconnect();
}

if (require.main === module) run();
module.exports = { run };
