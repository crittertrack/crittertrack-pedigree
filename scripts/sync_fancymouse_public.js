#!/usr/bin/env node
/** 
 * Sync Fancy Mouse lifeStage to PublicAnimal collection.
 * Run this after migrating lifeStage on Animal records.
 * 
 * Usage:
 *   node sync_fancymouse_public.js            # Dry run (logs only)
 *   node sync_fancymouse_public.js --apply  # Actually update PublicAnimal
 * 
 * This script processes ONLY public Fancy Mouse records (isDisplay === true)
 * in batches to avoid timeout. Private animals are intentionally excluded.
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const { Animal, PublicAnimal } = require('../database/models');

const dryRun = !process.argv.includes('--apply');
console.log('Mode:', dryRun ? 'DRY RUN' : 'APPLY');

async function syncGuineaPigPublic() {
    await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
    console.log('Connected');
    
    // Get ONLY public Guinea Pig animals (isDisplay === true)
    // Private animals (isDisplay === false) are intentionally excluded from PublicAnimal
    const animals = await Animal.find({ species: 'Guinea Pig', isDisplay: true })
        .select('id_public lifeStage birthDate')
        .lean();
    
    const totalAnimals = await Animal.countDocuments({ species: 'Guinea Pig', isDisplay: true });
    console.log(`Processing ${totalAnimals} PUBLIC Guinea Pig animals (isDisplay=true)`);
    console.log(`Total Guinea Pig in Animal: ${await Animal.countDocuments({ species: 'Guinea Pig' })}`);
    
    let synced = 0;
    let skipped = 0;
    let batched = 0;
    
    // Process in batches of 100 to avoid timeout
    const batchSize = 100;
    for (let i = 0; i < animals.length; i += batchSize) {
        const batch = animals.slice(i, i + batchSize);
        batched++;
        
        console.log(`Batch ${batched}: Processing records ${i} to ${Math.min(i + batchSize, animals.length)}`);
        
        for (const a of batch) {
            // Use the already-calculated lifeStage from Animal (already migrated)
            const calculatedStage = a.lifeStage;
            
            // Build public animal fields with just lifeStage
            const publicFields = {
                lifeStage: calculatedStage || null,
                id_public: a.id_public,
            };
            
            // Check if PublicAnimal already has this lifeStage
            const publicAnimal = await PublicAnimal.findOne({ id_public: a.id_public }).lean();
            
            if (publicAnimal && publicAnimal.lifeStage === calculatedStage) {
                skipped++;
                continue;
            }
            
            if (!dryRun) {
                await PublicAnimal.updateOne(
                    { id_public: a.id_public },
                    { $set: publicFields },
                    { upsert: true }
                );
            }
            synced++;
        }
        
        // Brief pause between batches to avoid overwhelming the DB
        if (i + batchSize < animals.length) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }
    
    console.log(`\n${dryRun ? 'Dry run: ' : ''}Synced ${synced} Guinea Pig to PublicAnimal`);
    console.log(`${dryRun ? 'Would skip' : 'Skipped'} ${skipped} (already up to date or no change needed)`);
    console.log(`Batches processed: ${batched}`);
    
    await mongoose.disconnect();
    console.log('Disconnected');
}

syncGuineaPigPublic().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});