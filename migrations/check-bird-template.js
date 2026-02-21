require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const { FieldTemplate } = require('../database/models');

async function run() {
    await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);
    const template = await FieldTemplate.findOne({ name: 'Bird Template' });
    if (!template) { console.log('NOT FOUND'); process.exit(1); }

    const enabled = [];
    const disabled = [];

    for (const [fieldName, config] of Object.entries(template.fields.toObject())) {
        if (config.enabled) {
            enabled.push(`  ✅ ${fieldName}: "${config.label}"`);
        } else {
            disabled.push(`  ❌ ${fieldName}: "${config.label}"`);
        }
    }

    console.log(`\nBird Template (${template._id})`);
    console.log(`Enabled (${enabled.length}):\n${enabled.join('\n')}`);
    console.log(`\nDisabled (${disabled.length}):\n${disabled.join('\n')}`);
    await mongoose.disconnect();
}
run().catch(e => { console.error(e); process.exit(1); });
