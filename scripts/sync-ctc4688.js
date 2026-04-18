require('dotenv').config();
const mongoose = require('mongoose');
const { Animal } = require('../database/models');

(async () => {
    await mongoose.connect(process.env.MONGODB_URI);
    
    const animal = await Animal.findOne({ id_public: 'CTC4688' });
    if (!animal) {
        console.log('❌ CTC4688 not found');
        process.exit(1);
    }
    
    // Check if manualPedigree has parent data
    if (!animal.manualPedigree || !animal.manualPedigree.sire || !animal.manualPedigree.dam) {
        console.log('❌ manualPedigree data missing');
        process.exit(1);
    }
    
    const sireId = animal.manualPedigree.sire.ctcId;
    const damId = animal.manualPedigree.dam.ctcId;
    
    console.log(`🔄 Syncing CTC4688:`);
    console.log(`   Sire: ${sireId}`);
    console.log(`   Dam: ${damId}`);
    
    // Trigger the sync by updating the animal
    animal.sireId_public = sireId;
    animal.damId_public = damId;
    
    await animal.save();
    
    console.log(`✅ CTC4688 synced successfully!`);
    console.log(`   sireId_public: ${animal.sireId_public}`);
    console.log(`   damId_public: ${animal.damId_public}`);
    
    await mongoose.disconnect();
})();
