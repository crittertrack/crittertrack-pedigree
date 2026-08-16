require('dotenv').config();
const mongoose = require('mongoose');
const { PublicProfile } = require('../database/models');

(async () => {
    await mongoose.connect(process.env.MONGODB_URI);
    const profile = await PublicProfile.findOne({ id_public: 'CTU2' });
    const map = profile.animalBreedingLines || {};

    const ops = [];
    for (const id of Object.keys(map)) {
        const lines = map[id] || [];
        const hasAny = lines.includes(0) || lines.includes(1) || lines.includes(2);
        const hasLegacy = lines.includes(10);
        if (hasAny && !hasLegacy) {
            ops.push({
                updateOne: {
                    filter: { id_public: 'CTU2' },
                    update: { $addToSet: { [`animalBreedingLines.${id}`]: 10 } },
                },
            });
        }
    }

    console.log('Animals to update:', ops.length);
    if (ops.length > 0) {
        const result = await PublicProfile.bulkWrite(ops);
        console.log('Modified count:', result.modifiedCount);
    }

    await mongoose.disconnect();
})();
