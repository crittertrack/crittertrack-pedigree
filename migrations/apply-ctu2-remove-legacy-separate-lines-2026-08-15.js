require('dotenv').config();
const mongoose = require('mongoose');
const { PublicProfile } = require('../database/models');

const BL_PRESETS_APP = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#3b82f6', '#6366f1', '#a855f7', '#934E69', '#64748b'];
const LINES_TO_REMOVE = [0, 1, 2]; // Dom Red (Legacy), Brindle (Legacy), Merle (Legacy) — superseded by Legacy(10)

(async () => {
    await mongoose.connect(process.env.MONGODB_URI);
    const profile = await PublicProfile.findOne({ id_public: 'CTU2' });

    // Mirror the UI's handleDeleteBreedingLine: blank the def slot, keep array length/ids stable
    const resetDefs = profile.breedingLineDefs.map(l =>
        LINES_TO_REMOVE.includes(l.id) ? { id: l.id, name: '', color: BL_PRESETS_APP[l.id] || l.color, enabled: true } : l
    );

    const map = profile.animalBreedingLines || {};
    let changedCount = 0;
    const cleanedAssignments = {};
    for (const [animalId, lineIds] of Object.entries(map)) {
        const filtered = (lineIds || []).filter(id => !LINES_TO_REMOVE.includes(id));
        cleanedAssignments[animalId] = filtered;
        if (filtered.length !== (lineIds || []).length) changedCount++;
    }

    console.log('Animals with 0/1/2 stripped:', changedCount);

    await PublicProfile.updateOne(
        { id_public: 'CTU2' },
        { $set: { breedingLineDefs: resetDefs, animalBreedingLines: cleanedAssignments } }
    );

    console.log('Saved.');
    await mongoose.disconnect();
})();
