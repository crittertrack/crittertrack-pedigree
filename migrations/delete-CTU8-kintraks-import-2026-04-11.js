/**
 * One-time cleanup: Delete all Animal (and PublicAnimal) records owned by CTU8
 * that were created on 2026-04-11 (the failed Kintraks import stubs).
 *
 * Runs a dry-run count first, then prompts confirmation via CONFIRM=true env var.
 *
 * Usage (dry run):  node migrations/delete-CTU8-kintraks-import-2026-04-11.js
 * Usage (execute):  CONFIRM=true node migrations/delete-CTU8-kintraks-import-2026-04-11.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const { Animal, PublicAnimal } = require('../database/models');

const OWNER   = 'CTU8';
const DAY_START = new Date('2026-04-11T00:00:00.000Z');
const DAY_END   = new Date('2026-04-11T23:59:59.999Z');

const FILTER = {
    ownerId_public: OWNER,
    createdAt: { $gte: DAY_START, $lte: DAY_END },
};

async function run() {
    const uri = process.env.MONGODB_URI;
    if (!uri) { console.error('MONGODB_URI not set'); process.exit(1); }

    await mongoose.connect(uri);
    console.log('Connected to MongoDB\n');

    const animalCount = await Animal.countDocuments(FILTER);
    const publicCount = await PublicAnimal.countDocuments(FILTER);

    console.log(`Animals matching CTU8 + created today: ${animalCount}`);
    console.log(`PublicAnimals matching CTU8 + created today: ${publicCount}`);

    if (animalCount === 0 && publicCount === 0) {
        console.log('\nNothing to delete. Exiting.');
        await mongoose.disconnect();
        return;
    }

    if (process.env.CONFIRM !== 'true') {
        console.log('\nDRY RUN — no changes made.');
        console.log('Re-run with CONFIRM=true to execute the deletion.');
        await mongoose.disconnect();
        return;
    }

    console.log('\nExecuting deletion...');
    const animalResult = await Animal.deleteMany(FILTER);
    console.log(`Animal: deleted ${animalResult.deletedCount}`);

    const publicResult = await PublicAnimal.deleteMany(FILTER);
    console.log(`PublicAnimal: deleted ${publicResult.deletedCount}`);

    console.log('\nDone!');
    await mongoose.disconnect();
}

run().catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
});
