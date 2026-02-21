/**
 * Migration: Fix Bird Template - Reproductive fields + physical fields
 * - Disables isPregnant, isNursing, isInMating (not applicable to birds)
 * - Disables nailColor (not applicable to birds)
 * - Enables eyeColor (applicable to birds)
 * - Disables matingDates, ovulationDate (not applicable to birds)
 *
 * These fields were previously missing from FieldTemplateSchema so they
 * could not be controlled via the template system. Schema was updated to
 * include them; this migration sets the correct values for the Bird Template.
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

    const update = {
        // Disable reproductive status checkboxes (birds don't have mammalian pregnancy/nursing)
        'fields.isPregnant.enabled': false,
        'fields.isPregnant.label': 'Pregnant',
        'fields.isNursing.enabled': false,
        'fields.isNursing.label': 'Nursing',
        'fields.isInMating.enabled': false,
        'fields.isInMating.label': 'In Mating',
        // Disable mating/ovulation date fields
        'fields.matingDates.enabled': false,
        'fields.ovulationDate.enabled': false,
        // Disable nail/claw color (birds have beaks/talons, not nails)
        'fields.nailColor.enabled': false,
        'fields.nailColor.label': 'Nail/Claw Color',
        // Enable eye color (birds have distinct eye colors)
        'fields.eyeColor.enabled': true,
        'fields.eyeColor.label': 'Eye Color',
    };

    const result = await FieldTemplate.updateOne(
        { name: 'Bird Template' },
        { $set: update }
    );

    console.log('Update result:', result);
    console.log('\nVerifying changes...');

    const updated = await FieldTemplate.findOne({ name: 'Bird Template' });
    const fields = updated.fields;
    console.log('isPregnant enabled:', fields.isPregnant?.enabled);
    console.log('isNursing enabled:', fields.isNursing?.enabled);
    console.log('isInMating enabled:', fields.isInMating?.enabled);
    console.log('nailColor enabled:', fields.nailColor?.enabled);
    console.log('eyeColor enabled:', fields.eyeColor?.enabled);
    console.log('matingDates enabled:', fields.matingDates?.enabled);
    console.log('ovulationDate enabled:', fields.ovulationDate?.enabled);

    await mongoose.disconnect();
    console.log('\nDone!');
}

run().catch(e => { console.error(e); process.exit(1); });
