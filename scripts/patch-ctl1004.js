require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const { Litter } = require('../database/models');

mongoose.connect(process.env.MONGODB_URI).then(async () => {
    const r = await Litter.updateOne(
        { litter_id_public: 'CTL1004' },
        { $set: { breedingPairCodeName: null } }
    );
    console.log('Patched CTL1004:', r.modifiedCount, 'modified');
    // Verify
    const doc = await Litter.findOne({ litter_id_public: 'CTL1004' }).select('breedingPairCodeName litter_id_public').lean();
    console.log('CTL1004 breedingPairCodeName is now:', JSON.stringify(doc?.breedingPairCodeName));
    await mongoose.disconnect();
}).catch(e => { console.error(e); process.exit(1); });
