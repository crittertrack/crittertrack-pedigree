#!/usr/bin/env node
/**
 * Sync Fancy Mouse lifeStage to PublicAnimal collection.
 * Run this after migrating lifeStage on Animal records.
 * 
 * Usage:
 *   node sync_fancymouse_public.js            # Dry run (logs only)
 *   node sync_fancymouse_public.js --apply  # Actually update PublicAnimal
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const { Animal, PublicAnimal } = require('../database/models');
const { calculateLifeStageFromBirthDate } = require('../utils/lifeStageUtils');

const dryRun = !process.argv.includes('--apply');
console.log('Mode:', dryRun ? 'DRY RUN' : 'APPLY');

async function syncBatch() {
    await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
    console.log('Connected');

    // Find Fancy Mouse animals - process in small batches
    const query = {
        species: 'Fancy Mouse'
    };

    const BATCH_SIZE = 100;
    let totalSynced = 0;
    let totalSkipped = 0;

    // Use cursor for efficient iteration
    const cursor = Animal.find(query).cursor();
    
    for await (const a of cursor) {
        // Calculate lifeStage from birthDate
        const calculatedStage = calculateLifeStageFromBirthDate(a.birthDate, a.species);

        // If lifeStage already matches, skip
        if (a.lifeStage === calculatedStage) {
            totalSkipped++;
            continue;
        }

        // Build public animal fields - only sync lifeStage and essential fields
        const publicFields = {
            lifeStage: calculatedStage || null,
            id_public: a.id_public,
            species: a.species,
        };

        if (!dryRun) {
            await PublicAnimal.updateOne(
                { id_public: a.id_public },
                { $set: publicFields },
                { upsert: true }
            );
        }
        totalSynced++;
        
        // Log progress every 100 animals
        if (totalSynced % 100 === 0) {
            console.log(`Progress: ${totalSynced} synced, ${totalSkipped} skipped`);
        }
    }

    console.log(`\nComplete: ${totalSynced} Fancy Mouse synced to PublicAnimal`);
    console.log(`Skipped ${totalSkipped} (lifeStage already up to date)`);
    
    await mongoose.disconnect();
    console.log('Disconnected');
    return true;
}

syncBatch();