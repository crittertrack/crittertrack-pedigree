// Consolidates prefix variants on CTU8's archived animals that differ only by curly vs.
// straight apostrophe (same breeder, inconsistent typing) — all normalized to the plain
// straight apostrophe (').
require('dotenv').config();
const mongoose = require('mongoose');
const { Animal, PublicAnimal, User } = require('../database/models');

const CONSOLIDATIONS = [
    { from: 'Ray\u2019s', to: "Ray's" },
    { from: 'MMM\u2019s', to: "MMM's" },
    { from: 'Lyn\u2019s', to: "Lyn's" },
    { from: 'Blueberry\u2019s', to: "Blueberry's" },
    { from: 'Cozy Comet\u2019s', to: "Cozy Comet's" },
    { from: 'Little Foot\u2019s', to: "Little Foot's" },
    { from: 'COCM', to: 'CoCM' },
    { from: 'MMM', to: "MMM's" },
    { from: 'SLM', to: "SLM's" },
    { from: 'DA', to: 'DAHV' },
    { from: 'HV', to: 'DAHV' },
];

(async () => {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB.\n');

    const ctu8 = await User.findOne({ id_public: 'CTU8' }).select('_id');
    if (!ctu8) {
        console.error('CTU8 not found. Aborting.');
        await mongoose.disconnect();
        return;
    }

    for (const { from, to } of CONSOLIDATIONS) {
        const filter = { creatorId: ctu8._id, archived: true, prefix: from };
        const matches = await Animal.find(filter).select('id_public');
        console.log(`"${from}" -> "${to}": ${matches.length} animal(s)`);
        if (matches.length === 0) continue;

        await Animal.updateMany(filter, { $set: { prefix: to } });

        const ids = matches.map(a => a.id_public);
        await PublicAnimal.updateMany(
            { id_public: { $in: ids }, prefix: from },
            { $set: { prefix: to } }
        );
    }

    console.log('\nDone.');
    await mongoose.disconnect();
})();
