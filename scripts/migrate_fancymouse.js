#!/usr/bin/env node
/**
 * Migration script - processes ONE batch of Fancy Mouse animals.
 * Run repeatedly until all animals are migrated.
 * 
 * Usage:
 *   node migrate_fancymouse.js            # Dry run (logs only)
 *   node migrate_fancymouse.js --apply    # Actually update
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const { calculateLifeStageFromBirthDate } = require('../utils/lifeStageUtils');
const { Animal } = require('../database/models');

const dryRun = !process.argv.includes('--apply');
console.log('Mode:', dryRun ? 'DRY RUN' : 'APPLY');

async function migrateBatch() {
    await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
    console.log('Connected');

    // Find one batch of animals needing migration
    const query = {
        species: 'Guinea Pig',
        lifeStage: { $in: ['Unknown', ''] },
        birthDate: { $exists: true, $ne: null }
    };

    const BATCH_SIZE = 150;  // Small batch to avoid timeout
    const animals = await Animal.find(query)
        .limit(BATCH_SIZE)
        .lean();

    if (animals.length === 0) {
        console.log('No more animals needing migration');
        await mongoose.disconnect();
        return false;
    }

    console.log(`Found ${animals.length} animals in this batch`);

    let updated = 0;
    for (const a of animals) {
        const stage = calculateLifeStageFromBirthDate(a.birthDate, a.species || 'Unknown');
        if (stage !== 'Unknown') {
            if (!dryRun) {
                await Animal.updateOne({ _id: a._id }, { $set: { lifeStage: stage } });
            }
            updated++;
        }
    }

    console.log(`Updated ${updated} of ${animals.length} animals`);
    
    // Show a few examples
    let shown = 0;
    for (const a of animals) {
        if (shown < 3) {
            const stage = calculateLifeStageFromBirthDate(a.birthDate, a.species || 'Unknown');
            console.log(`  ${a.id_public}: ${a.lifeStage} -> ${stage}`);
            shown++;
        }
    }

    await mongoose.disconnect();
    console.log('Disconnected');
    return true;
}

migrateBatch();