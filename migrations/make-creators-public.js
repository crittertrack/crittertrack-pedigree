/**
 * Migration: Make all animals from specific creators public
 * 
 * This migration sets all animals from specified creators to public,
 * including archived animals, to ensure pedigree visibility.
 * 
 * Creators: CTU1, CTU2, CTU8, CTU107, CTU77, CTU5
 */

require('dotenv').config();

const { Animal, PublicAnimal } = require('../database/models');
const { syncAnimalToPublic } = require('../utils/syncPublicAnimals');

async function makeCreatorsPublic(options = {}) {
    const dryRun = options.dryRun !== false;
    const verbose = options.verbose === true;
    const creatorIds = ['CTU1', 'CTU2', 'CTU8', 'CTU107', 'CTU77', 'CTU5'];
    
    try {
        console.log('[MIGRATION] Making all animals from specified creators PUBLIC...');
        if (dryRun) console.log('(DRY-RUN MODE - No changes will be made)\n');
        else console.log('(MAKING ACTUAL CHANGES)\n');

        // Count and list animals from these creators
        console.log('[STEP 1] Analyzing animals from target creators...');
        const targetAnimals = await Animal.find({
            creatorId_public: { $in: creatorIds }
        }).select('id_public name creatorId_public showOnPublicProfile archived species').lean();

        console.log(`  Found ${targetAnimals.length} animals from specified creators:\n`);
        
        const byCreator = {};
        const byStatus = { public: 0, private: 0, archived: 0 };
        
        targetAnimals.forEach(a => {
            if (!byCreator[a.creatorId_public]) byCreator[a.creatorId_public] = 0;
            byCreator[a.creatorId_public]++;
            
            if (a.archived) byStatus.archived++;
            else if (a.showOnPublicProfile) byStatus.public++;
            else byStatus.private++;
        });

        Object.entries(byCreator).forEach(([creator, count]) => {
            console.log(`    ${creator}: ${count} animals`);
        });
        console.log(`\n  Status breakdown:`);
        console.log(`    Currently public: ${byStatus.public}`);
        console.log(`    Currently private: ${byStatus.private}`);
        console.log(`    Archived: ${byStatus.archived}\n`);

        // Update all to public
        console.log('[STEP 2] Setting showOnPublicProfile = true for all...');
        const alreadyPublic = targetAnimals.filter(a => a.showOnPublicProfile).length;
        const toMakePublic = targetAnimals.length - alreadyPublic;

        if (toMakePublic > 0) {
            if (!dryRun) {
                const result = await Animal.updateMany(
                    { creatorId_public: { $in: creatorIds } },
                    { showOnPublicProfile: true }
                );
                console.log(`  ✓ Updated ${result.modifiedCount} animals to public\n`);
            } else {
                console.log(`  [DRY-RUN] Would update ${toMakePublic} animals to public\n`);
            }
        } else {
            console.log('  ✓ All animals already public\n');
        }

        // Get updated list and sync to PublicAnimal (including archived)
        console.log('[STEP 3] Syncing to PublicAnimal collection...');
        const updatedAnimals = await Animal.find({
            creatorId_public: { $in: creatorIds },
            showOnPublicProfile: true
        }).lean();

        console.log(`  Found ${updatedAnimals.length} public animals from target creators`);
        
        if (!dryRun) {
            let syncedCount = 0;
            let errorCount = 0;

            for (const animal of updatedAnimals) {
                try {
                    await syncAnimalToPublic(animal);
                    syncedCount++;
                } catch (err) {
                    console.error(`  Error syncing ${animal.id_public}:`, err.message);
                    errorCount++;
                }
            }

            console.log(`  ✓ Synced ${syncedCount} animals to PublicAnimal`);
            if (errorCount > 0) console.log(`  ⚠️  ${errorCount} errors during sync`);
            console.log('');
        } else {
            console.log(`  [DRY-RUN] Would sync ${updatedAnimals.length} animals to PublicAnimal\n`);
        }

        // Summary
        console.log('[MIGRATION] Summary:');
        if (dryRun) {
            console.log('  Mode: DRY-RUN (no changes made)');
            console.log(`  Would make ${toMakePublic} animals public`);
            console.log(`  Would sync ${updatedAnimals.length} animals to PublicAnimal`);
            console.log('\n  To apply changes, run:');
            console.log('    node migrations/make-creators-public.js --fix\n');
        } else {
            console.log('  Mode: FIX (changes applied)');
            console.log(`  Made ${toMakePublic} animals public`);
            console.log(`  Synced ${updatedAnimals.length} animals to PublicAnimal`);
            console.log('\nMigration completed successfully!');
        }

    } catch (error) {
        console.error('[MIGRATION] Error during migration:', error);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    const args = process.argv.slice(2);
    const dryRun = !args.includes('--fix');
    const verbose = args.includes('--verbose');
    
    console.log('Usage: node migrations/make-creators-public.js [OPTIONS]\n');
    console.log('Options:');
    console.log('  (no args)     - DRY-RUN: Show what would be changed (default)');
    console.log('  --fix         - MAKE CHANGES: Actually fix the database');
    console.log('  --verbose     - Show detailed information\n');
    
    if (!dryRun) {
        console.log('⚠️  WARNING: Running in FIX mode - changes will be made to the database!\n');
    }
    
    const { connectDB } = require('../database/db_service');
    const MONGODB_URI = process.env.MONGODB_URI;
    
    if (!MONGODB_URI) {
        console.error('ERROR: MONGODB_URI not set in environment variables');
        process.exit(1);
    }
    
    connectDB(MONGODB_URI).then(() => {
        makeCreatorsPublic({ dryRun, verbose }).then(() => process.exit(0));
    }).catch(err => {
        console.error('Failed to connect to database:', err.message);
        process.exit(1);
    });
}

module.exports = { makeCreatorsPublic };
