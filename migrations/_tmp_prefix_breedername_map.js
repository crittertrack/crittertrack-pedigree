require('dotenv').config();
const mongoose = require('mongoose');
const { Animal, User } = require('../database/models');

(async () => {
    await mongoose.connect(process.env.MONGODB_URI);
    const ctu8 = await User.findOne({ id_public: 'CTU8' }).select('_id');
    if (!ctu8) { console.log('CTU8 not found'); await mongoose.disconnect(); return; }

    const animals = await Animal.find({ creatorId: ctu8._id, archived: true })
        .select('prefix manualBreederName breederId_public')
        .lean();

    // Group by prefix, tally manualBreederName variants seen for each.
    const byPrefix = {};
    animals.forEach(a => {
        const p = a.prefix || '(none)';
        if (!byPrefix[p]) byPrefix[p] = { total: 0, names: {}, linked: 0 };
        byPrefix[p].total += 1;
        if (a.breederId_public) byPrefix[p].linked += 1;
        const n = a.manualBreederName || '(blank)';
        byPrefix[p].names[n] = (byPrefix[p].names[n] || 0) + 1;
    });

    const prefixes = Object.keys(byPrefix).filter(p => p !== '(none)').sort();
    console.log(`${prefixes.length} prefixes (excluding "(none)")\n`);

    for (const p of prefixes) {
        const info = byPrefix[p];
        const variants = Object.entries(info.names).sort((a, b) => b[1] - a[1]);
        const variantStr = variants.map(([n, c]) => `${n} (${c})`).join(' | ');
        const flag = variants.length > 1 ? '  <-- MULTIPLE NAME VARIANTS' : '';
        console.log(`${p}\t[${info.total} animals, ${info.linked} already linked]\t${variantStr}${flag}`);
    }

    await mongoose.disconnect();
})();
