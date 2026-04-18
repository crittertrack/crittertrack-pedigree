require('dotenv').config();
const mongoose = require('mongoose');
const { Animal } = require('../database/models');

(async () => {
    await mongoose.connect(process.env.MONGODB_URI);
    const a = await Animal.findOne({ id_public: 'CTC4688' }).lean();
    if (!a) { console.log('NOT FOUND'); process.exit(1); }
    
    console.log('=== CTC4688 Data ===');
    console.log('id_public:', a.id_public);
    console.log('name:', a.name);
    console.log('\n=== Canonical Parents ===');
    console.log('sireId_public:', a.sireId_public);
    console.log('damId_public:', a.damId_public);
    console.log('\n=== Manual Pedigree ===');
    console.log('manualPedigree:', JSON.stringify(a.manualPedigree, null, 2));
    
    await mongoose.disconnect();
})();
