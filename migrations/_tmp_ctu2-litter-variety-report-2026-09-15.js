require('dotenv').config();
const mongoose = require('mongoose');
const { User, Litter, Animal } = require('../database/models');

const variety = (a) => {
    if (!a) return 'Unknown';
    return [a.color, a.markings, a.coat].filter(Boolean).join(', ') || 'Unknown';
};

(async () => {
    await mongoose.connect(process.env.MONGODB_URI);

    const ctu2 = await User.findOne({ id_public: 'CTU2' }).select('_id').lean();
    if (!ctu2) { console.log('CTU2 not found'); await mongoose.disconnect(); return; }

    const litters = await Litter.find({ creatorId: ctu2._id, offspringIds_public: { $exists: true, $ne: [] } })
        .sort({ birthDate: 1 })
        .lean();

    console.log(`CTU2 - ${litters.length} litters with offspring\n`);

    for (const litter of litters) {
        const [sire, dam] = await Promise.all([
            litter.sireId_public ? Animal.findOne({ id_public: litter.sireId_public }).select('color markings coat name').lean() : null,
            litter.damId_public ? Animal.findOne({ id_public: litter.damId_public }).select('color markings coat name').lean() : null,
        ]);
        const offspring = litter.offspringIds_public.length
            ? await Animal.find({ id_public: { $in: litter.offspringIds_public } }).select('color markings coat').lean()
            : [];
        const offspringVarieties = [...new Set(offspring.map(variety))];

        const label = litter.litter_id_public || litter.breedingPairCodeName || litter._id.toString();
        const birthDate = litter.birthDate ? new Date(litter.birthDate).toISOString().slice(0, 10) : 'unborn/unknown';

        console.log(`## ${label} (${birthDate})`);
        console.log(`Sire: ${sire ? sire.name : litter.sirePrefixName || 'Unknown'} - ${variety(sire)}`);
        console.log(`Dam: ${dam ? dam.name : litter.damPrefixName || 'Unknown'} - ${variety(dam)}`);
        console.log(`Offspring varieties (${offspringVarieties.length} unique, ${offspring.length} total):`);
        offspringVarieties.forEach(v => console.log(`  - ${v}`));
        console.log('');
    }

    await mongoose.disconnect();
})();
