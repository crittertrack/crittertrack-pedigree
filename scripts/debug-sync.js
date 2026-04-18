require('dotenv').config();
const mongoose = require('mongoose');
const { Animal } = require('../database/models');

const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;

(async () => {
    try {
        console.log('🔗 Connecting to MongoDB...');
        await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 5000 });
        console.log('✅ Connected');
        
        console.log('📊 Counting animals with manual pedigree...');
        const count = await Animal.countDocuments({
            $or: [
                { 'manualPedigree.sire.ctcId': { $exists: true, $ne: null } },
                { 'manualPedigree.dam.ctcId': { $exists: true, $ne: null } }
            ]
        });
        
        console.log(`✅ Found ${count} animals with manual pedigree`);
        
        console.log('📊 Checking first 10 animals...');
        const sample = await Animal.find({
            $or: [
                { 'manualPedigree.sire.ctcId': { $exists: true, $ne: null } },
                { 'manualPedigree.dam.ctcId': { $exists: true, $ne: null } }
            ]
        }).limit(10);
        
        let mismatches = 0;
        for (const animal of sample) {
            const sireMismatch = animal.manualPedigree?.sire?.ctcId && animal.sireId_public !== animal.manualPedigree.sire.ctcId;
            const damMismatch = animal.manualPedigree?.dam?.ctcId && animal.damId_public !== animal.manualPedigree.dam.ctcId;
            
            if (sireMismatch || damMismatch) {
                console.log(`⚠️  ${animal.id_public}:`);
                if (sireMismatch) console.log(`   Sire: ${animal.sireId_public} vs ${animal.manualPedigree.sire.ctcId}`);
                if (damMismatch) console.log(`   Dam: ${animal.damId_public} vs ${animal.manualPedigree.dam.ctcId}`);
                mismatches++;
            }
        }
        
        console.log(`\n✅ Sample analysis: ${mismatches} mismatches in first 10`);
        
        await mongoose.disconnect();
        console.log('✅ Disconnected');
    } catch (err) {
        console.error('❌ Error:', err.message);
        process.exit(1);
    }
})();
