require('dotenv').config();
const mongoose = require('mongoose');
const { Animal, PublicProfile, User } = require('../database/models');

(async () => {
    await mongoose.connect(process.env.MONGODB_URI);
    const user = await User.findOne({ id_public: 'CTU2' });
    const profile = await PublicProfile.findOne({ id_public: 'CTU2' });
    if (!profile) { console.log('CTU2 public profile not found'); process.exit(1); }

    console.log('breedingLineDefs:');
    console.log(JSON.stringify(profile.breedingLineDefs, null, 2));

    const assign = profile.animalBreedingLines || {};
    const assignedIds = Object.keys(assign);
    console.log('\nTotal animals with any breeding line assignment:', assignedIds.length);

    // Breakdown by line id
    const byLine = {};
    assignedIds.forEach(id => {
        (assign[id] || []).forEach(lineId => {
            byLine[lineId] = (byLine[lineId] || 0) + 1;
        });
    });
    console.log('Assignment counts by lineId:', JSON.stringify(byLine, null, 2));

    console.log('\nSample assignments (first 25):');
    for (const id of assignedIds.slice(0, 25)) {
        const a = await Animal.findOne({ id_public: id }, 'name species sireId_public damId_public creatorId').lean();
        const owner = a && a.creatorId?.toString() === user._id.toString() ? 'CTU2' : 'other/unknown';
        console.log(' ', id, '->', assign[id], '|', a ? a.name : '(not found)', '| owner:', owner, '| sire:', a?.sireId_public, '| dam:', a?.damId_public);
    }

    await mongoose.disconnect();
})();
