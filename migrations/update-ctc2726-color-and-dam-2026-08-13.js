// One-off: sets CTC2726's color to "Dominant Red" and reassigns its dam to CTC2676.
// Mirrors the change into PublicAnimal (if the animal is displayed publicly) so the public
// profile stays in sync, and clears inbreedingCoefficient since a parent changed (same as
// updateAnimal() does in db_service.js).
// Run with: node migrations/update-ctc2726-color-and-dam-2026-08-13.js
require('dotenv').config();
const mongoose = require('mongoose');
const { Animal, PublicAnimal } = require('../database/models');

async function main() {
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error('MONGODB_URI not found in environment variables.');
    await mongoose.connect(uri);
    console.log('Connected to MongoDB.\n');

    const animal = await Animal.findOne({ id_public: 'CTC2726' });
    if (!animal) throw new Error('CTC2726 not found.');

    const dam = await Animal.findOne({ id_public: 'CTC2676' });
    if (!dam) throw new Error('CTC2676 (new dam) not found.');

    const set = { color: 'Dominant Red', damId_public: 'CTC2676', inbreedingCoefficient: null };
    await Animal.updateOne({ _id: animal._id }, { $set: set });
    console.log(`CTC2726: updated ${JSON.stringify(set)}`);

    const publicUpdate = await PublicAnimal.updateOne({ id_public: 'CTC2726' }, { $set: set });
    console.log(`PublicAnimal CTC2726: matched ${publicUpdate.matchedCount}, modified ${publicUpdate.modifiedCount}`);

    await mongoose.disconnect();
}

main().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
