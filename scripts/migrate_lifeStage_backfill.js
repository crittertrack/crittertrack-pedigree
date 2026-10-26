#!/usr/bin/env node
/**
 * Migration script to backfill lifeStage for existing animals.
 *
 * Finds all animals where:
 *   - lifeStage is 'Unknown' or '' or null
 *   - birthDate is set (exists and is a valid date)
 *
 * Then calculates the appropriate lifeStage based on species and age,
 * and updates the animal in the database.
 *
 * Usage:
 *   node migrate_lifeStage_backfill.js            # Dry run (logs only)
 *   node migrate_lifeStage_backfill.js --apply    # Actually update
 *   node migrate_lifeStage_backfill.js --species "Fancy Mouse" --apply --limit 1000
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const { calculateLifeStageFromBirthDate } = require('../utils/lifeStageUtils');
const { Animal } = require('../database/models');

// Parse CLI args
const dryRun = !process.argv.includes('--apply');
const speciesArg = process.argv.find(a => a.startsWith('--species='));
const limitArg = process.argv.find(a => a.startsWith('--limit='));
const LIMIT = limitArg ? parseInt(limitArg.split('=')[1], 10) : null;

const TARGET_SPECIES = speciesArg
    ? [speciesArg.split('=')[1]]
    : [
        'Fancy Mouse',
        'Fancy Rat',
        'Russian Hamster',
        'Campbell\'s Hamster',
        'Chinese Hamster',
        'Syrian Hamster',
        'Guinea Pig'
    ];

console.log('Starting migration...');
console.log('MONGODB_URI set:', !!process.env.MONGODB_URI);
console.log('Mode:', dryRun ? 'DRY RUN' : 'APPLY');
console.log('Limit:', LIMIT || 'none');

async function migrateLifeStage() {
    if (!process.env.MONGODB_URI) {
        console.error('MONGODB_URI is not set');
        process.exit(1);
    }

    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI, {
        serverSelectionTimeoutMS: 5000,
        connectTimeoutMS: 5000,
    });
    console.log('Connected!');

    try {
        let totalProcessed = 0;
        let totalUpdated = 0;
        let globalLimitReached = false;

        for (const species of TARGET_SPECIES) {
            if (globalLimitReached) break;

            console.log(`\n=== Processing species: ${species} ===`);

            const query = {
                species: species,
                lifeStage: { $in: ['Unknown', ''] },
                birthDate: { $exists: true, $ne: null }
            };

            const speciesCount = await Animal.countDocuments(query);
            console.log(`Found ${speciesCount} animals needing migration`);

            if (speciesCount === 0) {
                continue;
            }

            const batchSize = 1000;
            let speciesProcessed = 0;
            let speciesUpdated = 0;

            for (let skip = 0; skip < speciesCount; skip += batchSize) {
                if (globalLimitReached) break;

                const animals = await Animal.find(query)
                    .skip(skip)
                    .limit(batchSize)
                    .lean();

                console.log(`  Batch: ${animals.length} animals at skip ${skip}`);

                if (dryRun) {
                    let logged = 0;
                    for (const animal of animals) {
                        const stage = calculateLifeStageFromBirthDate(
                            animal.birthDate,
                            animal.species || 'Unknown'
                        );
                        if (stage !== 'Unknown' && logged < 5) {
                            console.log(`    [DRY RUN] ${animal.id_public} (${animal.species}): ${animal.lifeStage} -> ${stage}`);
                            logged++;
                        }
                    }
                    speciesProcessed += animals.length;
                } else {
                    const bulkOps = [];
                    for (const animal of animals) {
                        const stage = calculateLifeStageFromBirthDate(
                            animal.birthDate,
                            animal.species || 'Unknown'
                        );
                        if (stage !== 'Unknown') {
                            bulkOps.push({
                                updateOne: {
                                    filter: { _id: animal._id },
                                    update: { $set: { lifeStage: stage } }
                                }
                            });
                        }
                    }

                    if (bulkOps.length > 0) {
                        const result = await Animal.bulkWrite(bulkOps, { ordered: false });
                        speciesUpdated += result.modifiedCount;
                        console.log(`    Batch updated: ${result.modifiedCount} animals`);
                    }
                    speciesProcessed += animals.length;
                }

                totalProcessed += animals.length;

                // Check global limit
                if (LIMIT && totalProcessed >= LIMIT) {
                    globalLimitReached = true;
                    console.log(`  Reached limit of ${LIMIT}, stopping.`);
                    break;
                }
            }

            totalUpdated += speciesUpdated;

            console.log(`  ${species}: ${speciesProcessed} processed, ${speciesUpdated} updated`);
        }

        console.log(`\n=== Migration complete ===`);
        console.log(`Total: ${totalUpdated} of ${totalProcessed} animals updated`);
        return totalUpdated;
    } finally {
        console.log('Disconnecting...');
        await mongoose.disconnect();
        console.log('Disconnected.');
    }
}