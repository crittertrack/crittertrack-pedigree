/**
 * Migration: Update Bird Template in MongoDB
 * - Disables non-bird fields
 * - Enables leashTrained with label "Harness Trained"
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const { FieldTemplate } = require('../database/models');

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;

async function run() {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');

    const template = await FieldTemplate.findOne({ name: 'Bird Template' });
    if (!template) {
        console.error('Bird Template not found!');
        process.exit(1);
    }
    console.log('Found Bird Template:', template._id);

    // Fields to DISABLE
    const toDisable = [
        'coat',
        'phenotype',
        'morph',
        'markings',
        'nailColor',
        'groomingNeeds',
        'workingTitles',
        'isNeutered',
        'isInfertile',
        'isPregnant',
        'isNursing',
        'isInMating',
        'isStudAnimal',
        'isDamAnimal',
        'transferHistory',
    ];

    // Fields to ENABLE with label overrides
    const toEnable = [
        { field: 'leashTrained', label: 'Harness Trained' },
    ];

    const update = {};

    for (const field of toDisable) {
        update[`fields.${field}.enabled`] = false;
    }

    for (const { field, label } of toEnable) {
        update[`fields.${field}.enabled`] = true;
        update[`fields.${field}.label`] = label;
    }

    const result = await FieldTemplate.updateOne(
        { name: 'Bird Template' },
        { $set: update }
    );

    console.log('Update result:', result);
    console.log('Fields disabled:', toDisable);
    console.log('Fields enabled/updated:', toEnable.map(e => e.field));

    await mongoose.disconnect();
    console.log('Done.');
}

run().catch(err => {
    console.error('Migration failed:', err);
    mongoose.disconnect();
    process.exit(1);
});
