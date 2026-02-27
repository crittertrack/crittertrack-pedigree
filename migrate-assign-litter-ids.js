/**
 * Migration: Assign CTL-IDs to all litters
 * 
 * This script assigns unique litter_id_public (CTL-IDs) to all existing litters
 * in the database. It uses the same sequence system as animals (CTC) and users (CTU).
 * 
 * Run with: node migrate-assign-litter-ids.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { Litter } = require('./database/models');
const { getNextSequence, connectDB } = require('./database/db_service');

const migrateLitterIds = async () => {
    try {
        console.log('\n📋 Starting Litter ID Migration...\n');
        
        // Get all litters that don't have a litter_id_public yet
        const littersWithoutId = await Litter.find({ litter_id_public: null });
        
        if (littersWithoutId.length === 0) {
            console.log('✓ All litters already have CTL-IDs assigned. No migration needed.');
            process.exit(0);
        }
        
        console.log(`Found ${littersWithoutId.length} litters without CTL-IDs\n`);
        
        let assigned = 0;
        let failed = 0;
        
        for (const litter of littersWithoutId) {
            try {
                // Generate next CTL-ID
                const litterId = await getNextSequence('litterId');
                
                // Assign to litter (keeps existing breedingPairCodeName if present)
                litter.litter_id_public = litterId;
                await litter.save();
                
                assigned++;
                const codeName = litter.breedingPairCodeName ? ` (${litter.breedingPairCodeName})` : '';
                console.log(`✓ Assigned ${litterId}${codeName} to litter (Owner: ${litter.ownerId})`);
            } catch (error) {
                failed++;
                console.error(`✗ Failed to assign ID to litter ${litter._id}:`, error.message);
            }
        }
        
        console.log(`\n✓ Migration Complete!`);
        console.log(`  Assigned: ${assigned}`);
        console.log(`  Failed: ${failed}`);
        console.log(`  Total: ${assigned + failed}\n`);
        
        process.exit(0);
    } catch (error) {
        console.error('✗ Migration error:', error.message);
        process.exit(1);
    }
};

const main = async () => {
    await connectDB();
    await migrateLitterIds();
};

main();
