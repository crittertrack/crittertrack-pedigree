require('dotenv').config();
const mongoose = require('mongoose');
const { FieldTemplate } = require('./database/models');

async function showTemplateFields() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        
        const templates = await FieldTemplate.find({ isDefault: true }).sort('name');
        
        console.log('\n========================================');
        console.log('FIELD TEMPLATE SUMMARY');
        console.log('========================================\n');
        
        for (const template of templates) {
            console.log(`\n>>> ${template.name.toUpperCase()}`);
            console.log('='.repeat(60));
            
            const enabled = [];
            const disabled = [];
            
            Object.keys(template.fields).forEach(field => {
                if (template.fields[field].enabled) {
                    enabled.push(field);
                } else {
                    disabled.push(field);
                }
            });
            
            console.log(`\nENABLED FIELDS (${enabled.length} total):`);
            console.log('-'.repeat(60));
            enabled.forEach(f => {
                const label = template.fields[f].label || f;
                console.log(`  [X] ${f.padEnd(30)} -> "${label}"`);
            });
            
            console.log(`\nDISABLED FIELDS (${disabled.length} total):`);
            console.log('-'.repeat(60));
            disabled.forEach(f => {
                const label = template.fields[f].label || f;
                console.log(`  [ ] ${f.padEnd(30)} -> "${label}"`);
            });
            
            console.log('\n');
        }
        
        await mongoose.disconnect();
        process.exit(0);
        
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

showTemplateFields();
