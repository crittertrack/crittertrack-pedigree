require('dotenv').config();
const mongoose = require('mongoose');
const { Species, FieldTemplate } = require('./database/models');

mongoose.connect(process.env.MONGODB_URI).then(async () => {
    const species = await Species.find({}).populate('fieldTemplateId').sort('name');
    
    console.log('\n========================================');
    console.log('SPECIES → TEMPLATE ASSIGNMENTS');
    console.log('========================================\n');
    
    let withTemplate = 0;
    let withoutTemplate = 0;
    
    species.forEach(s => {
        const templateName = s.fieldTemplateId?.name || '❌ NO TEMPLATE';
        console.log(`${s.name.padEnd(30)} → ${templateName}`);
        
        if (s.fieldTemplateId) {
            withTemplate++;
        } else {
            withoutTemplate++;
        }
    });
    
    console.log('\n========================================');
    console.log(`Total species: ${species.length}`);
    console.log(`✅ With templates: ${withTemplate}`);
    console.log(`❌ Without templates: ${withoutTemplate}`);
    console.log('========================================\n');
    
    await mongoose.disconnect();
    process.exit(0);
});
