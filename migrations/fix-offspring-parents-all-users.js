/**
 * Migration: Fix Offspring Parent Data Loss Across All Users
 * 
 * Issue: All offspring linked to litters lost their parent information (sireId_public, damId_public)
 * during recent litter management updates.
 * 
 * Solution: This script iterates through all litters and restores parent data for linked offspring,
 * ensuring offspring in litter management have correct sire and dam information.
 * 
 * Usage: node migrations/fix-offspring-parents-all-users.js
 */

const mongoose = require('mongoose');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const mongoUri = process.env.MONGODB_URI;
if (!mongoUri) {
    console.error('❌ MONGODB_URI not set in .env file');
    process.exit(1);
}

// Import models
const { Animal, Litter, User } = require('../database/models');

async function fixOffspringParents() {
    let connection = null;
    try {
        // Connect to MongoDB
        connection = await mongoose.connect(mongoUri);
        console.log('✓ Connected to MongoDB\n');

        // Find all litters with linked offspring
        const litters = await Litter.find({
            offspringIds_public: { $exists: true, $ne: [] }
        }).select('_id ownerId sireId_public sirePrefixName damId_public damPrefixName offspringIds_public breedingPairCodeName').lean();

        console.log(`📋 Found ${litters.length} litters with linked offspring\n`);

        let totalFixed = 0;
        let totalAlreadyCorrect = 0;
        let totalErrors = 0;
        let totalLittersProcessed = 0;

        // Process each litter
        for (const litter of litters) {
            totalLittersProcessed++;
            try {
                const owner = await User.findById(litter.ownerId).select('breederName personalName email').lean();
                const ownerInfo = owner?.breederName || owner?.personalName || owner?.email || 'Unknown User';

                console.log(`\n[${totalLittersProcessed}/${litters.length}] 📚 Litter: ${litter.breedingPairCodeName || litter._id}`);
                console.log(`   Owner: ${ownerInfo}`);
                console.log(`   Sire: ${litter.sirePrefixName || litter.sireId_public || 'None'}`);
                console.log(`   Dam: ${litter.damPrefixName || litter.damId_public || 'None'}`);
                console.log(`   Offspring to process: ${litter.offspringIds_public.length}`);

                // Batch fetch all offspring at once for efficiency
                const offspringAnimals = await Animal.find(
                    { id_public: { $in: litter.offspringIds_public } },
                    { _id: 1, id_public: 1, prefix: 1, name: 1, sireId_public: 1, damId_public: 1 }
                ).lean();

                const offspringMap = new Map(offspringAnimals.map(a => [a.id_public, a]));

                // Fix each offspring linked to this litter
                for (const offspringId_public of litter.offspringIds_public) {
                    try {
                        const offspring = offspringMap.get(offspringId_public);

                        if (!offspring) {
                            console.log(`   ⚠️  Offspring ${offspringId_public} not found in database`);
                            totalErrors++;
                            continue;
                        }

                        // Check if parents need updating
                        const needsSireUpdate = litter.sireId_public && offspring.sireId_public !== litter.sireId_public;
                        const needsDamUpdate = litter.damId_public && offspring.damId_public !== litter.damId_public;

                        if (needsSireUpdate || needsDamUpdate) {
                            // Update offspring with correct parent IDs
                            const updateData = {};
                            if (needsSireUpdate) {
                                updateData.sireId_public = litter.sireId_public;
                            }
                            if (needsDamUpdate) {
                                updateData.damId_public = litter.damId_public;
                            }

                            await Animal.findByIdAndUpdate(offspring._id, updateData);

                            const offspringName = offspring.prefix ? `${offspring.prefix} ${offspring.name}` : offspring.name;
                            console.log(`   ✓ FIXED: ${offspringName} (${offspringId_public})`);
                            totalFixed++;
                        } else {
                            const offspringName = offspring.prefix ? `${offspring.prefix} ${offspring.name}` : offspring.name;
                            console.log(`   ✓ OK: ${offspringName} (already correct)`);
                            totalAlreadyCorrect++;
                        }
                    } catch (err) {
                        console.log(`   ✗ ERROR updating offspring ${offspringId_public}: ${err.message}`);
                        totalErrors++;
                    }
                }
            } catch (err) {
                console.log(`✗ ERROR processing litter ${litter._id}: ${err.message}`);
                totalErrors++;
            }
        }

        console.log(`\n\n========================================`);
        console.log(`✅ MIGRATION COMPLETE`);
        console.log(`========================================`);
        console.log(`   Litters processed: ${totalLittersProcessed}`);
        console.log(`   Offspring fixed: ${totalFixed}`);
        console.log(`   Offspring already correct: ${totalAlreadyCorrect}`);
        console.log(`   Errors: ${totalErrors}`);
        console.log(`========================================\n`);

        await mongoose.connection.close();
        console.log('✓ Disconnected from MongoDB\n');
        process.exit(totalErrors > 0 ? 1 : 0);
    } catch (err) {
        console.error('\n❌ MIGRATION FAILED:', err.message);
        if (connection) {
            await mongoose.connection.close();
        }
        process.exit(1);
    }
}

// Run migration
fixOffspringParents();
