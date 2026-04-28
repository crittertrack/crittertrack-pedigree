require('dotenv').config();
const mongoose = require('mongoose');
const { Litter, Animal } = require('../database/models');

async function run() {
    await mongoose.connect(process.env.MONGODB_URI);

    const newSire = await Animal.findOne({ id_public: 'CTC2930' }).select('id_public prefix name').lean();
    if (!newSire) {
        console.error('CTC2930 not found!');
        process.exit(1);
    }
    const sirePrefixName = [newSire.prefix, newSire.name].filter(Boolean).join(' ');
    console.log('New sire display name:', sirePrefixName);

    const result = await Litter.updateOne(
        { litter_id_public: 'CTL485' },
        { $set: { sireId_public: 'CTC2930', sirePrefixName: sirePrefixName } }
    );
    console.log('Litter update result:', JSON.stringify(result));

    const updated = await Litter.findOne({ litter_id_public: 'CTL485' }).select('litter_id_public sireId_public sirePrefixName damId_public').lean();
    console.log('Updated litter:', JSON.stringify(updated, null, 2));

    await mongoose.disconnect();
}

run().catch(err => { console.error(err); process.exit(1); });
