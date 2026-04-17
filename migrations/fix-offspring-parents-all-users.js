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

// Import models
const { Animal, Litter, User } = require('../database/models');

async function fixOffspringParents() {
    try {
        // Connect to MongoDB
        await mongoose.connect(mongoUri);
        console.log('✓ Connected to MongoDB');

        // Find all litters with linked offspring
        const litters = await Litter.find({
            offspringIds_public: { $exists: true, $ne: [] }
        }).select('_id ownerId sireId_public sirePrefixName damId_public damPrefixName offspringIds_public breedingPairCodeName');

        console.log(`\n📋 Found ${litters.length} litters with linked offspring\n`);

        let totalFixed = 0;
        let totalErrors = 0;

        // Process each litter
        for (const litter of litters) {
            try {
                const owner = await User.findById(litter.ownerId).select('breederName personalName email');
                const ownerInfo = owner?.breederName || owner?.personalName || owner?.email || 'Unknown User';

                console.log(`\n📚 Litter: ${litter.breedingPairCodeName || litter._id} (Owner: ${ownerInfo})`);
                console.log(`   Sire: ${litter.sirePrefixName || litter.sireId_public || 'None'}`);
                console.log(`   Dam: ${litter.damPrefixName || litter.damId_public || 'None'}`);
                console.log(`   Offspring to fix: ${litter.offspringIds_public.length}`);

                // Fix each offspring linked to this litter
                for (const offspringId_public of litter.offspringIds_public) {
                    try {
                        const offspring = await Animal.findOne({ id_public: offspringId_public });

                        if (!offspring) {
                            console.log(`   ⚠️  Offspring ${offspringId_public} not found`);
                            continue;
                        }

                        // Check if parents need updating
                        const needsSireUpdate = litter.sireId_public && offspring.sireId_public !== litter.sireId_public;
                        const needsDamUpdate = litter.damId_public && offspring.damId_public !== litter.damId_public;

                        if (needsSireUpdate || needsDamUpdate) {
                            // Get sire/dam animals to include in offspring record
                            let sireAnimal = null;
                            let damAnimal = null;

                            if (litter.sireId_public) {
                                sireAnimal = await Animal.findOne({ id_public: litter.sireId_public })
                                    .select('id_public prefix name gender');
                            }

                            if (litter.damId_public) {
                                damAnimal = await Animal.findOne({ id_public: litter.damId_public })
                                    .select('id_public prefix name gender');
                            }

                            // Update offspring with correct parent IDs
                            const updateData = {};
                            if (needsSireUpdate) {
                                updateData.sireId_public = litter.sireId_public;
                            }
                            if (needsDamUpdate) {
                                updateData.damId_public = litter.damId_public;
                            }

                            await Animal.findByIdAndUpdate(offspring._id, updateData, { new: true });

                            const sireName = sireAnimal ? `${sireAnimal.prefix ? sireAnimal.prefix + ' ' : ''}${sireAnimal.name}` : 'None';
                            const damName = damAnimal ? `${damAnimal.prefix ? damAnimal.prefix + ' ' : ''}${damAnimal.name}` : 'None';
                            
                            console.log(`   ✓ ${offspring.prefix ? offspring.prefix + ' ' : ''}${offspring.name} → Sire: ${sireName}, Dam: ${damName}`);
                            totalFixed++;
                        } else {
                            console.log(`   ✓ ${offspring.prefix ? offspring.prefix + ' ' : ''}${offspring.name} (already correct)`);
                        }
                    } catch (err) {
                        console.log(`   ✗ Error updating offspring ${offspringId_public}: ${err.message}`);
                        totalErrors++;
                    }
                }
            } catch (err) {
                console.log(`✗ Error processing litter ${litter._id}: ${err.message}`);
                totalErrors++;
            }
        }

        console.log(`\n✅ Migration Complete`);
        console.log(`   Fixed: ${totalFixed} offspring`);
        console.log(`   Errors: ${totalErrors}`);

        await mongoose.connection.close();
        console.log('\n✓ Disconnected from MongoDB');
    } catch (err) {
        console.error('❌ Migration failed:', err);
        process.exit(1);
    }
}

// Run migration
fixOffspringParents();
