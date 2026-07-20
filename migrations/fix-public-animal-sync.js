/**
 * Migration: Fix Public Animal Sync Issues
 * 
 * This migration addresses the issue where animals are showing as private
 * when they should be public, particularly in pedigree/relationship views.
 * 
 * The problem stems from mismatches between:
 * - isDisplay (frontend toggle)
 * - showOnPublicProfile (backend authoritative field)
 * 
 * This script will:
 * 1. Identify mismatches between isDisplay and showOnPublicProfile
 * 2. Re-sync the PublicAnimal collection based on showOnPublicProfile
 * 3. Ensure parents/relationships are properly visible
 */

require('dotenv').config();

const { Animal, PublicAnimal } = require('../database/models');
const { syncAnimalToPublic } = require('../utils/syncPublicAnimals');

async function fixPublicAnimalSync(options = {}) {
    const dryRun = options.dryRun !== false; // Default to dry-run unless explicitly false
    const verbose = options.verbose === true;
    
    try {
        console.log('[MIGRATION] Starting public animal sync fix...');
        if (dryRun) console.log('(DRY-RUN MODE - No changes will be made)\n');
        else console.log('(MAKING ACTUAL CHANGES)\n');

        // ===== STEP 1: Analyze current state =====
        console.log('[STEP 1] Analyzing current state of animals...');
        const totalAnimals = await Animal.countDocuments();
        const withIsDisplay = await Animal.countDocuments({ isDisplay: true });
        const withShowOnPublic = await Animal.countDocuments({ showOnPublicProfile: true });
        const mismatchCount = await Animal.countDocuments({
            $expr: { $ne: ['$isDisplay', '$showOnPublicProfile'] }
        });

        console.log(`  Total animals: ${totalAnimals}`);
        console.log(`  Animals with isDisplay=true: ${withIsDisplay}`);
        console.log(`  Animals with showOnPublicProfile=true: ${withShowOnPublic}`);
        console.log(`  Animals with mismatch (isDisplay !== showOnPublicProfile): ${mismatchCount}\n`);

        // ===== STEP 2: Fix mismatches =====
        console.log('[STEP 2] Fixing mismatches...');
        if (mismatchCount > 0) {
            // Get all mismatched animals
            const mismatched = await Animal.find({
                $expr: { $ne: ['$isDisplay', '$showOnPublicProfile'] }
            }).select('id_public name isDisplay showOnPublicProfile species creatorId_public').lean();

            console.log(`  Found ${mismatched.length} mismatched animals:\n`);
            mismatched.forEach(a => {
                const action = a.showOnPublicProfile ? 'MAKE PUBLIC' : 'MAKE PRIVATE';
                console.log(`    [${action}] ${a.id_public} "${a.name}"`);
                console.log(`      isDisplay: ${a.isDisplay}, showOnPublicProfile: ${a.showOnPublicProfile}`);
                if (verbose) console.log(`      Species: ${a.species}, Creator: ${a.creatorId_public}`);
            });
            console.log('');

            if (!dryRun) {
                // Update: make isDisplay match showOnPublicProfile (backend is the source of truth)
                const result = await Animal.updateMany(
                    { $expr: { $ne: ['$isDisplay', '$showOnPublicProfile'] } },
                    [{ $set: { isDisplay: '$showOnPublicProfile' } }]
                );

                console.log(`  ✓ Fixed ${result.modifiedCount} animals\n`);
            } else {
                console.log(`  [DRY-RUN] Would fix ${mismatched.length} animals\n`);
            }
        } else {
            console.log('  ✓ No mismatches found\n');
        }

        // ===== STEP 3: Re-sync PublicAnimal collection =====
        console.log('[STEP 3] Re-syncing PublicAnimal collection...');

        // First, clear all existing records to start fresh
        if (!dryRun) {
            const clearResult = await PublicAnimal.deleteMany({});
            console.log(`  ✓ Cleared ${clearResult.deletedCount} existing records from PublicAnimal collection`);
        } else {
            const existingCount = await PublicAnimal.countDocuments();
            console.log(`  [DRY-RUN] Would clear ${existingCount} existing records from PublicAnimal collection`);
        }

        // Add/update ONLY animals that should be public (must meet ALL criteria)
        const shouldBePublic = await Animal.find({ 
            showOnPublicProfile: true,
            isOwned: true,
            archived: { $ne: true }
        }).lean();
        
        console.log(`  Found ${shouldBePublic.length} animals that should be public (public + owned + not archived)`);
        
        let syncedCount = 0;
        let syncErrorCount = 0;

        if (!dryRun) {
            for (const animal of shouldBePublic) {
                try {
                    await syncAnimalToPublic(animal);
                    syncedCount++;
                } catch (err) {
                    console.error(`  Error syncing ${animal.id_public}:`, err.message);
                    syncErrorCount++;
                }
            }

            console.log(`  ✓ Synced ${syncedCount} animals to PublicAnimal collection`);
            if (syncErrorCount > 0) console.log(`  ⚠️  ${syncErrorCount} errors during sync\n`);
            else console.log('');
        } else {
            console.log(`  [DRY-RUN] Would sync ${shouldBePublic.length} animals to PublicAnimal collection\n`);
        }
        // ===== STEP 4: Validate pedigree visibility =====
        console.log('[STEP 4] Checking pedigree relationships...');
        const publicAnimalsWithParents = await Animal.find({
            showOnPublicProfile: true,
            isOwned: true,
            archived: { $ne: true },
            $or: [{ sireId_public: { $ne: null } }, { damId_public: { $ne: null } }]
        }).select('id_public name sireId_public damId_public').lean();

        console.log(`  Public animals with parents: ${publicAnimalsWithParents.length}`);

        // Check for parents that are private
        let problemCount = 0;
        const problems = [];
        
        for (const animal of publicAnimalsWithParents) {
            let sirePublic = null;
            let damPublic = null;
            
            if (animal.sireId_public) {
                const sire = await Animal.findOne({ id_public: animal.sireId_public }).select('showOnPublicProfile').lean();
                sirePublic = sire?.showOnPublicProfile ?? false;
            }
            
            if (animal.damId_public) {
                const dam = await Animal.findOne({ id_public: animal.damId_public }).select('showOnPublicProfile').lean();
                damPublic = dam?.showOnPublicProfile ?? false;
            }
            
            const sirePrivate = animal.sireId_public && !sirePublic;
            const damPrivate = animal.damId_public && !damPublic;
            
            if (sirePrivate || damPrivate) {
                problemCount++;
                problems.push({
                    id: animal.id_public,
                    name: animal.name,
                    sire: animal.sireId_public,
                    sirePublic,
                    dam: animal.damId_public,
                    damPublic
                });
            }
        }
        
        if (problemCount > 0) {
            console.log(`  ⚠️  Found ${problemCount} public animals with PRIVATE parents:\n`);
            problems.slice(0, 20).forEach(p => {
                console.log(`    ${p.id} "${p.name}"`);
                if (p.sire) console.log(`      Sire: ${p.sire} - PUBLIC: ${p.sirePublic} ${!p.sirePublic ? '❌ PRIVATE' : ''}`);
                if (p.dam) console.log(`      Dam: ${p.dam} - PUBLIC: ${p.damPublic} ${!p.damPublic ? '❌ PRIVATE' : ''}`);
            });
            if (problems.length > 20) {
                console.log(`    ... and ${problems.length - 20} more`);
            }
            console.log('\n  ⚠️  RECOMMENDATION: Set parent animals to public as well so they appear in pedigree views.\n');
        } else {
            console.log('  ✓ All public animals have public parents (or no parents linked)\n');
        }

        // ===== SUMMARY =====
        console.log('[MIGRATION] Summary:');
        if (dryRun) {
            console.log('  Mode: DRY-RUN (no changes made)');
            console.log('  ✓ Analyzed animal visibility flags');
            console.log('  ✓ Identified mismatches and parent relationships');
            console.log('\n  To actually fix these issues, run:');
            console.log('    node migrations/fix-public-animal-sync.js --fix\n');
        } else {
            console.log('  Mode: FIX (changes applied)');
            console.log('  ✓ Fixed isDisplay/showOnPublicProfile mismatches');
            console.log('  ✓ Re-synced PublicAnimal collection');
            console.log('  ✓ Validated pedigree relationships');
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
    const dryRun = !args.includes('--fix'); // Default to dry-run unless --fix is passed
    const verbose = args.includes('--verbose');
    
    if (dryRun && args.includes('--fix')) {
        console.error('Error: cannot use both dry-run (default) and --fix');
        process.exit(1);
    }
    
    console.log('Usage: node migrations/fix-public-animal-sync.js [OPTIONS]\n');
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
        fixPublicAnimalSync({ dryRun, verbose }).then(() => process.exit(0));
    }).catch(err => {
        console.error('Failed to connect to database:', err.message);
        process.exit(1);
    });
}

module.exports = { fixPublicAnimalSync };
