require('dotenv').config();
const mongoose = require('mongoose');
const { PublicProfile } = require('../database/models');

(async () => {
    await mongoose.connect(process.env.MONGODB_URI);
    const profile = await PublicProfile.findOne({ id_public: 'CTU2' });
    console.log('breedingLineDefs:');
    console.log(JSON.stringify(profile.breedingLineDefs, null, 2));

    const map = profile.animalBreedingLines || {};
    const ids = Object.keys(map);
    let has0or1or2 = 0, hasLegacyAlready = 0, hasAllThree = 0, has0or1or2NoLegacy = 0;
    for (const id of ids) {
        const lines = map[id] || [];
        const hasAny = lines.includes(0) || lines.includes(1) || lines.includes(2);
        const hasAll = lines.includes(0) && lines.includes(1) && lines.includes(2);
        const hasLegacy = lines.includes(10);
        if (hasAny) has0or1or2++;
        if (hasAll) hasAllThree++;
        if (hasLegacy) hasLegacyAlready++;
        if (hasAny && !hasLegacy) has0or1or2NoLegacy++;
    }
    console.log('Total animals with any line assignment:', ids.length);
    console.log('Animals with any of 0/1/2:', has0or1or2);
    console.log('Animals with all of 0/1/2:', hasAllThree);
    console.log('Animals already with Legacy(10):', hasLegacyAlready);
    console.log('Animals with 0/1/2 but missing Legacy(10):', has0or1or2NoLegacy);

    await mongoose.disconnect();
})();
