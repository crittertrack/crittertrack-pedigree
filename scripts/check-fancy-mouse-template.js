require('dotenv').config();
const mongoose = require('mongoose');

mongoose.connect(process.env.MONGODB_URI).then(async () => {
    const db = mongoose.connection.db;
    
    // Find Fancy Mouse species
    const species = await db.collection('species').findOne({ name: 'Fancy Mouse' });
    console.log('Fancy Mouse species:', JSON.stringify({ name: species?.name, category: species?.category, fieldTemplateId: species?.fieldTemplateId }, null, 2));
    
    // Find the field template
    let template = null;
    if (species?.fieldTemplateId) {
        template = await db.collection('fieldtemplates').findOne({ _id: species.fieldTemplateId });
    }
    if (!template) {
        // Try by category
        template = await db.collection('fieldtemplates').findOne({ name: 'Small Mammal Template' });
        console.log('Falling back to Small Mammal Template');
    }
    
    if (template) {
        const appearanceFields = ['color', 'coatPattern', 'coat', 'earset', 'phenotype', 'morph', 'markings', 'eyeColor', 'nailColor', 'size', 'carrierTraits'];
        console.log('\nTemplate:', template.name);
        console.log('Appearance field states:');
        appearanceFields.forEach(f => {
            const field = template.fields?.[f];
            console.log(`  ${f}: enabled=${field?.enabled}, exists=${!!field}`);
        });
    } else {
        console.log('No template found!');
    }
    
    await mongoose.disconnect();
});
