/**
 * Migration: Clean Up Orphaned Offspring References from Litters
 * 
 * Issue: 56 offspring IDs are referenced in litter records but don't exist in the database.
 * These are ghost references from deleted animals.
 * 
 * Solution: This script removes these orphaned offspring references from all litter records.
 * 
 * Usage: node migrations/cleanup-orphaned-offspring-references.js
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
const { Litter } = require('../database/models');

// List of 56 orphaned offspring IDs
const orphanedOffspringIds = [
    'CTC92', 'CTC94', 'CTC93', 'CTC407', 'CTC458', 'CTC452', 'CTC456', 'CTC453', 
    'CTC459', 'CTC451', 'CTC462', 'CTC467', 'CTC468', 'CTC469', 'CTC470', 'CTC471', 
    'CTC1028', 'CTC550', 'CTC598', 'CTC599', 'CTC600', 'CTC610', 'CTC613', 'CTC612', 
    'CTC611', 'CTC1098', 'CTC2060', 'CTC627', 'CTC1957', 'CTC1905', 'CTC1996', 'CTC2002', 
    'CTC2000', 'CTC1997', 'CTC1999', 'CTC2001', 'CTC1998', 'CTC1956', 'CTC2330', 'CTC2039', 
    'CTC2034', 'CTC2038', 'CTC2036', 'CTC2035', 'CTC2037', 'CTC4484', 'CTC4490', 'CTC4488', 
    'CTC4486', 'CTC2181', 'CTC2401', 'CTC2412', 'CTC2505', 'CTC2559', 'CTC2562', 'CTC2564'
];

async function cleanupOrphanedReferences() {
    let connection = null;
    try {
        // Connect to MongoDB
        connection = await mongoose.connect(mongoUri);
        console.log('✓ Connected to MongoDB\n');

        console.log(`🧹 Cleaning up ${orphanedOffspringIds.length} orphaned offspring references...\n`);

        let totalLittersProcessed = 0;
        let totalReferencesRemoved = 0;
        let littersModified = [];

        // Find all litters that contain any orphaned offspring
        const littersWithOrphans = await Litter.find({
            offspringIds_public: { $in: orphanedOffspringIds }
        }).select('_id breedingPairCodeName offspringIds_public').lean();

        console.log(`📋 Found ${littersWithOrphans.length} litters with orphaned references\n`);

        // Remove orphaned references from each litter
        for (const litter of littersWithOrphans) {
            totalLittersProcessed++;
            
            const originalCount = litter.offspringIds_public.length;
            const filteredOffspring = litter.offspringIds_public.filter(
                id => !orphanedOffspringIds.includes(id)
            );
            const removedCount = originalCount - filteredOffspring.length;

            if (removedCount > 0) {
                // Update litter with cleaned offspring list
                await Litter.findByIdAndUpdate(
                    litter._id,
                    { offspringIds_public: filteredOffspring }
                );

                totalReferencesRemoved += removedCount;
                littersModified.push({
                    litterName: litter.breedingPairCodeName || litter._id,
                    removed: removedCount,
                    orphanedIds: litter.offspringIds_public.filter(id => orphanedOffspringIds.includes(id))
                });

                console.log(`[${totalLittersProcessed}/${littersWithOrphans.length}] 🗑️  Litter: ${litter.breedingPairCodeName || litter._id}`);
                console.log(`   Removed ${removedCount} orphaned reference(s): ${litter.offspringIds_public.filter(id => orphanedOffspringIds.includes(id)).join(', ')}`);
            }
        }

        console.log('\n========================================');
        console.log('✅ CLEANUP COMPLETE');
        console.log('========================================');
        console.log(`   Litters processed: ${totalLittersProcessed}`);
        console.log(`   Total orphaned references removed: ${totalReferencesRemoved}`);
        console.log('========================================\n');

        if (littersModified.length > 0) {
            console.log('📋 Summary of modified litters:');
            for (const litter of littersModified) {
                console.log(`   • ${litter.litterName}: removed ${litter.removed} reference(s)`);
                console.log(`     IDs: ${litter.orphanedIds.join(', ')}`);
            }
        }

    } catch (error) {
        console.error('❌ Error during cleanup:', error.message);
        process.exit(1);
    } finally {
        if (connection) {
            await mongoose.disconnect();
            console.log('\n✓ Disconnected from MongoDB');
        }
    }
}

cleanupOrphanedReferences();
