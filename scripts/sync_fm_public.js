#!/usr/bin/env node
/**
 * Sync Fancy Mouse lifeStage from Animal -> PublicAnimal.
 * One chunk per run. Use --skip N --limit N to page through.
 * Run with --apply to actually update.
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const { Animal, PublicAnimal } = require('../database/models');

const dryRun = !process.argv.includes('--apply');

// Parse --limit and --skip (support both --key=value and --key value formats)
let LIMIT = 100;
let SKIP = 0;
for (let i = 2; i < process.argv.length; i++) {
    const arg = process.argv[i];
    if (arg.startsWith('--limit=')) {
        LIMIT = parseInt(arg.split('=')[1], 10) || 100;
    } else if (arg === '--limit' && i + 1 < process.argv.length) {
        LIMIT = parseInt(process.argv[i + 1], 10) || 100;
        i++;
    } else if (arg.startsWith('--skip=')) {
        SKIP = parseInt(arg.split('=')[1], 10) || 0;
    } else if (arg === '--skip' && i + 1 < process.argv.length) {
        SKIP = parseInt(process.argv[i + 1], 10) || 0;
        i++;
    }
}

async function sync() {
    await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
    console.log('Connected');

    const publicAnimals = await Animal.find({ species: 'Fancy Mouse', isDisplay: true })
        .select('id_public lifeStage')
        .skip(SKIP)
        .limit(LIMIT)
        .lean();

    console.log(`Processing ${publicAnimals.length} public Fancy Mouse animals (skip=${SKIP}, limit=${LIMIT})`);

    const bulkOps = publicAnimals.map(a => ({
        updateOne: {
            filter: { id_public: a.id_public, species: 'Fancy Mouse' },
            update: { $set: { lifeStage: a.lifeStage || null } },
            upsert: true
        }
    }));

    let synced = 0;
    if (!dryRun && bulkOps.length > 0) {
        const result = await PublicAnimal.bulkWrite(bulkOps, { ordered: false });
        synced = result.modifiedCount + result.upsertedCount;
    } else if (dryRun) {
        synced = bulkOps.length;
    }

    console.log(`\n${dryRun ? 'DRY RUN: would sync' : 'Synced'} ${synced} Fancy Mouse lifeStage values to PublicAnimal`);
    await mongoose.disconnect();
    console.log('Done');
}

sync().catch(err => { console.error('Error:', err); process.exit(1); });