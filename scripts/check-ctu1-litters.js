require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const { Litter, User } = require('../database/models');

mongoose.connect(process.env.MONGODB_URI).then(async () => {
    const owner = await User.findOne({ id_public: 'CTU1' }).select('_id').lean();
    const litters = await Litter.find({ ownerId: owner._id })
        .select('litter_id_public breedingPairCodeName sireId_public damId_public isPlanned matingDate birthDate expectedDueDate')
        .sort({ litter_id_public: 1 })
        .lean();
    litters.forEach(l => {
        console.log(`${l.litter_id_public} | pairName: ${JSON.stringify(l.breedingPairCodeName)} | isPlanned: ${l.isPlanned} | matingDate: ${l.matingDate?.toISOString().slice(0,10) ?? 'null'} | birthDate: ${l.birthDate?.toISOString().slice(0,10) ?? 'null'} | sire: ${l.sireId_public} | dam: ${l.damId_public}`);
    });
    await mongoose.disconnect();
}).catch(e => { console.error(e); process.exit(1); });
