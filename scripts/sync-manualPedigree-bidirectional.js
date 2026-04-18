require('dotenv').config();
const mongoose = require('mongoose');
const { Animal } = require('../database/models');

const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;

(async () => {
    try {
        console.log('🔗 Connecting to MongoDB...');
        await mongoose.connect(mongoUri);
        console.log('✅ Connected');
        
        console.log('📊 Querying animals with manual pedigree parents...');
        const animalsWithManualParents = await Animal.find({
            $or: [
                { 'manualPedigree.sire.ctcId': { $exists: true, $ne: null } },
                { 'manualPedigree.dam.ctcId': { $exists: true, $ne: null } }
            ]
        }).lean();
        
        console.log(`✅ Found ${animalsWithManualParents.length} animals`);
        
        let updated = 0;
        let skipped = 0;
        let mismatches = [];
        
        for (let i = 0; i < animalsWithManualParents.length; i++) {
            const animal = animalsWithManualParents[i];
            const updates = {};
            let needsUpdate = false;
            
            // Check sire
            if (animal.manualPedigree?.sire?.ctcId && animal.sireId_public !== animal.manualPedigree.sire.ctcId) {
                updates.sireId_public = animal.manualPedigree.sire.ctcId;
                needsUpdate = true;
                mismatches.push(`${animal.id_public}: sire ${animal.sireId_public} → ${animal.manualPedigree.sire.ctcId}`);
            }
            
            // Check dam
            if (animal.manualPedigree?.dam?.ctcId && animal.damId_public !== animal.manualPedigree.dam.ctcId) {
                updates.damId_public = animal.manualPedigree.dam.ctcId;
                needsUpdate = true;
                mismatches.push(`${animal.id_public}: dam ${animal.damId_public} → ${animal.manualPedigree.dam.ctcId}`);
            }
            
            if (needsUpdate) {
                await Animal.updateOne({ _id: animal._id }, { $set: updates });
                updated++;
            } else {
                skipped++;
            }
            
            // Progress indicator every 100 animals
            if ((i + 1) % 100 === 0) {
                console.log(`⏳ Processed ${i + 1}/${animalsWithManualParents.length}`);
            }
        }
        
        console.log(`\n✅ Sync Complete:`);
        console.log(`   📋 Total animals: ${animalsWithManualParents.length}`);
        console.log(`   🔄 Updated: ${updated}`);
        console.log(`   ⊘ Already synced: ${skipped}`);
        
        if (mismatches.length > 0 && mismatches.length <= 20) {
            console.log(`\n📋 Mismatches found:`);
            mismatches.forEach(m => console.log(`   ${m}`));
        } else if (mismatches.length > 20) {
            console.log(`\n📋 First 20 of ${mismatches.length} mismatches:`);
            mismatches.slice(0, 20).forEach(m => console.log(`   ${m}`));
        }
        
        await mongoose.disconnect();
        console.log('\n✅ Disconnected');
    } catch (err) {
        console.error('❌ Error:', err.message);
        process.exit(1);
    }
})();
