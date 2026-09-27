require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const { Animal } = require('../database/models');

// One-off repair: the first run of _link_ctc927_dam_from_manual_2026-09-27.js wrote
// "Tue Oct 01" into the denormalized slot (String(Date).slice(0,10)) instead of "2013-10-01".
(async () => {
    await mongoose.connect(process.env.MONGODB_URI);
    const r = await Animal.updateOne(
        { id_public: 'CTC927', 'manualPedigree.dam.mode': 'ctc' },
        { $set: { 'manualPedigree.dam.birthDate': '2013-10-01' } }
    );
    console.log('modified:', r.modifiedCount);
    const after = await Animal.findOne({ id_public: 'CTC927' })
        .select('id_public manualPedigree.dam.birthDate').lean();
    console.log(JSON.stringify(after, null, 2));
    await mongoose.disconnect();
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });