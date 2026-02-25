/**
 * Enable microchipNumber field for Small Mammal templates
 * Run with: node enable-microchip-field.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { FieldTemplate } = require('./database/models');

const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/crittertrack';

async function run() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to MongoDB');

        const templates = await FieldTemplate.find({});
        const smallMammalNames = ['Small Mammal Template', 'Fancy Rat Template', 'Fancy Mouse Template'];
        const results = [];

        console.log(`Found ${templates.length} templates total`);
        console.log(`Looking for: ${smallMammalNames.join(', ')}`);

        for (const tmpl of templates) {
            console.log(`\nChecking template: ${tmpl.name}`);
            
            // Enable microchipNumber for small mammal templates
            if (smallMammalNames.includes(tmpl.name) && tmpl.fields?.microchipNumber) {
                const wasEnabled = tmpl.fields.microchipNumber.enabled;
                console.log(`  - microchipNumber currently enabled: ${wasEnabled}`);
                
                if (tmpl.fields.microchipNumber.enabled !== true) {
                    tmpl.fields.microchipNumber.enabled = true;
                    tmpl.markModified('fields');
                    await tmpl.save();
                    console.log(`  ✅ UPDATED: Enabled microchipNumber`);
                    results.push({ name: tmpl.name, updated: true });
                } else {
                    console.log(`  ℹ️  SKIPPED: Already enabled`);
                    results.push({ name: tmpl.name, updated: false, reason: 'already enabled' });
                }
            } else if (smallMammalNames.includes(tmpl.name)) {
                console.log(`  ⚠️  WARNING: microchipNumber field not found in template`);
            }
        }

        console.log('\n' + '='.repeat(60));
        console.log('MIGRATION COMPLETE');
        console.log('='.repeat(60));
        console.log(`Updated ${results.filter(r => r.updated).length} templates:`);
        results.forEach(r => {
            const status = r.updated ? '✅ Updated' : `ℹ️  Skipped (${r.reason || 'unknown'})`;
            console.log(`  ${r.name}: ${status}`);
        });
        console.log('='.repeat(60));

        await mongoose.disconnect();
        console.log('\nDatabase connection closed');
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        await mongoose.disconnect();
        process.exit(1);
    }
}

run();
