require('dotenv').config();
const mongoose = require('mongoose');
const { Animal, User } = require('../database/models');

(async () => {
    await mongoose.connect(process.env.MONGODB_URI);
    const ctu8 = await User.findOne({ id_public: 'CTU8' }).select('_id id_public');
    if (!ctu8) { console.log('CTU8 not found'); await mongoose.disconnect(); return; }

    const animals = await Animal.find({ creatorId: ctu8._id, archived: true })
        .select('prefix')
        .lean();

    const counts = {};
    animals.forEach(a => {
        const p = a.prefix || '(none)';
        counts[p] = (counts[p] || 0) + 1;
    });

    const sorted = Object.keys(counts).sort((a, b) => a.localeCompare(b));
    console.log('Total archived animals on CTU8:', animals.length);
    console.log('Unique prefixes:', sorted.length, '\n');
    sorted.forEach(p => console.log(`${p}\t${counts[p]}`));

    await mongoose.disconnect();
})();
