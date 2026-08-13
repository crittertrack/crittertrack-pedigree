require('dotenv').config();
const mongoose = require('mongoose');
const { Animal, User } = require('../database/models');

(async () => {
    await mongoose.connect(process.env.MONGODB_URI);
    const ctu8 = await User.findOne({ id_public: 'CTU8' }).select('_id id_public');
    if (!ctu8) { console.log('CTU8 not found'); await mongoose.disconnect(); return; }

    const animals = await Animal.find({ creatorId: ctu8._id, archived: true })
        .select('id_public name prefix suffix species breederId_public manualBreederName birthDate')
        .sort({ species: 1, name: 1 })
        .lean();

    console.log('Total archived animals on CTU8:', animals.length, '\n');
    for (const a of animals) {
        const displayName = `${a.prefix ? a.prefix + ' ' : ''}${a.name}${a.suffix ? ' ' + a.suffix : ''}`;
        console.log(`${a.id_public}\t${a.species}\t${displayName}\tbreederId_public=${a.breederId_public || 'null'}\tmanualBreederName=${a.manualBreederName || 'null'}`);
    }

    console.log('\n--- Unique manualBreederName values with NO breederId_public (candidates for new CTU2 contacts) ---');
    const manualOnly = animals.filter(a => !a.breederId_public && a.manualBreederName);
    const uniqueNames = [...new Set(manualOnly.map(a => a.manualBreederName))];
    uniqueNames.forEach(n => console.log('-', n));

    console.log('\n--- Animals with NEITHER breederId_public NOR manualBreederName set ---');
    const noBreederInfo = animals.filter(a => !a.breederId_public && !a.manualBreederName);
    noBreederInfo.forEach(a => console.log('-', a.id_public, a.name));

    await mongoose.disconnect();
})();
