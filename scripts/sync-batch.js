require('dotenv').config();
const mongoose = require('mongoose');
const { Animal } = require('../database/models');

const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;

(async () => {
    try {
        console.log('🔗 Connecting to MongoDB...');
        await mongoose.connect(mongoUri);
        console.log('✅ Connected');
        
        console.log('📊 Finding animals with manual pedigree...');
        const animalsWithManualParents = await Animal.find({
            $or: [
                { 'manualPedigree.sire.ctcId': { $exists: true, $ne: null } },
                { 'manualPedigree.dam.ctcId': { $exists: true, $ne: null } }
            ]
        }).lean();
        
        console.log(`✅ Found ${animalsWithManualParents.length} animals`);
        
        // Prepare bulk updates
        const operations = [];
        let mismatches = 0;
        
        for (const animal of animalsWithManualParents) {
            const updates = {};
            let hasUpdate = false;
            
            if (animal.manualPedigree?.sire?.ctcId && animal.sireId_public !== animal.manualPedigree.sire.ctcId) {
                updates.sireId_public = animal.manualPedigree.sire.ctcId;
                hasUpdate = true;
                mismatches++;
            }
            
            if (animal.manualPedigree?.dam?.ctcId && animal.damId_public !== animal.manualPedigree.dam.ctcId) {
                updates.damId_public = animal.manualPedigree.dam.ctcId;
                hasUpdate = true;
                if (!updates.sireId_public || animal.manualPedigree.sire?.ctcId === animal.sireId_public) {
                    // Only count as separate mismatch if we haven't already counted sire
                    if (!updates.sireId_public) mismatches++;
                }
            }
            
            if (hasUpdate) {
                operations.push({
                    updateOne: {
                        filter: { _id: animal._id },
                        update: { $set: updates }
                    }
                });
            }
        }
        
        console.log(`📋 Found ${operations.length} animals needing updates`);
        
        if (operations.length > 0) {
            console.log('⏳ Executing bulk updates...');
            const result = await Animal.bulkWrite(operations);
            console.log(`✅ Bulk update complete:`);
            console.log(`   Modified: ${result.modifiedCount}`);
        }
        
        console.log(`\n✅ Sync Complete:`);
        console.log(`   📊 Total with manual parents: ${animalsWithManualParents.length}`);
        console.log(`   🔄 Updated: ${operations.length}`);
        console.log(`   ⊘ Already synced: ${animalsWithManualParents.length - operations.length}`);
        console.log(`   ⚠️  Mismatches found: ${mismatches}`);
        
        await mongoose.disconnect();
        console.log('✅ Disconnected');
    } catch (err) {
        console.error('❌ Error:', err.message);
        process.exit(1);
    }
})();
