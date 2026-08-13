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

    // Print with char codes so straight vs curly apostrophes (and similar look-alikes) are visible.
    Object.keys(counts).sort().forEach(p => {
        const codes = [...p].map(ch => ch.charCodeAt(0).toString(16)).join(' ');
        console.log(JSON.stringify(p), counts[p], '|', codes);
    });

    await mongoose.disconnect();
})();
