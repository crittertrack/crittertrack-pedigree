require('dotenv').config();
const mongoose = require('mongoose');
const { Animal, User } = require('../database/models');

(async () => {
    await mongoose.connect(process.env.MONGODB_URI);
    const ctu8 = await User.findOne({ id_public: 'CTU8' }).select('_id id_public');
    if (!ctu8) { console.log('CTU8 not found'); await mongoose.disconnect(); return; }

    const animals = await Animal.find({ creatorId: ctu8._id, archived: true })
        .select('id_public breederId_public manualBreederName')
        .lean();

    const withLinkedBreeder = animals.filter(a => a.breederId_public);
    const manualOnly = animals.filter(a => !a.breederId_public && a.manualBreederName);
    const noBreederInfo = animals.filter(a => !a.breederId_public && !a.manualBreederName);
    const uniqueNames = [...new Set(manualOnly.map(a => a.manualBreederName))].sort();

    console.log('=== SUMMARY ===');
    console.log('Total archived animals on CTU8:', animals.length);
    console.log('Already linked to a Contact (breederId_public set):', withLinkedBreeder.length);
    console.log('Manual breeder name only (no linked contact) animal count:', manualOnly.length);
    console.log('No breeder info at all:', noBreederInfo.length);
    console.log('Unique manualBreederName values needing a Contact:', uniqueNames.length);
    console.log('\n=== UNIQUE NAMES (candidates for new CTU2 contacts) ===');
    uniqueNames.forEach(n => console.log('-', n));

    await mongoose.disconnect();
})();
