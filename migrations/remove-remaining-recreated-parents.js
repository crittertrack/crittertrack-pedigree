// Reverts the remaining 4 recreated parent placeholders: deletes the Animal records and
// nulls out sireId_public/damId_public on any animal/litter that referenced them.
// Run with: node migrations/remove-remaining-recreated-parents.js
require('dotenv').config();
const mongoose = require('mongoose');
const { Animal, Litter } = require('../database/models');

const TARGET_IDS = ['CTC1622', 'CTC1722', 'CTC4620', 'CTC4616'];

async function main() {
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error('MONGODB_URI not found in environment variables.');
    await mongoose.connect(uri);
    console.log('Connected to MongoDB.');

    const deleteResult = await Animal.deleteMany({ id_public: { $in: TARGET_IDS } });
    console.log(`Deleted ${deleteResult.deletedCount} animal record(s).`);

    const sireAnimalUpdate = await Animal.updateMany(
        { sireId_public: { $in: TARGET_IDS } },
        { $set: { sireId_public: null } }
    );
    console.log(`Cleared sireId_public on ${sireAnimalUpdate.modifiedCount} offspring animal(s).`);

    const damAnimalUpdate = await Animal.updateMany(
        { damId_public: { $in: TARGET_IDS } },
        { $set: { damId_public: null } }
    );
    console.log(`Cleared damId_public on ${damAnimalUpdate.modifiedCount} offspring animal(s).`);

    const sireLitterUpdate = await Litter.updateMany(
        { sireId_public: { $in: TARGET_IDS } },
        { $set: { sireId_public: null } }
    );
    console.log(`Cleared sireId_public on ${sireLitterUpdate.modifiedCount} litter record(s).`);

    const damLitterUpdate = await Litter.updateMany(
        { damId_public: { $in: TARGET_IDS } },
        { $set: { damId_public: null } }
    );
    console.log(`Cleared damId_public on ${damLitterUpdate.modifiedCount} litter record(s).`);

    await mongoose.disconnect();
}

main().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
