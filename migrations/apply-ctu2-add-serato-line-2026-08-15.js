// WRITE: create a new "Serato" breeding line in CTU2's first empty defs slot, and assign it
// founder-down from CTC2900 to every descendant (across all owners), matching the pattern used
// for Dom Red/Brindle/Merle (Legacy) and Daikon.
require('dotenv').config();
const mongoose = require('mongoose');
const { Animal, PublicProfile } = require('../database/models');

const FOUNDER_ID = 'CTC2900';
const LINE_NAME = 'Serato';

(async () => {
    await mongoose.connect(process.env.MONGODB_URI);
    const profile = await PublicProfile.findOne({ id_public: 'CTU2' });
    if (!profile) { console.log('CTU2 public profile not found'); process.exit(1); }

    const defs = profile.breedingLineDefs || [];
    const emptyIdx = defs.findIndex(d => !d.name);
    if (emptyIdx === -1) { console.log('No empty breeding line slot found'); process.exit(1); }
    const lineId = defs[emptyIdx].id;
    console.log(`Using slot id=${lineId} (index ${emptyIdx}, previous color=${defs[emptyIdx].color}) for "${LINE_NAME}"`);
    defs[emptyIdx].name = LINE_NAME;
    defs[emptyIdx].enabled = true;
    profile.breedingLineDefs = defs;
    profile.markModified('breedingLineDefs');

    const allAnimals = await Animal.find({}, 'id_public sireId_public damId_public').lean();
    const childrenMap = new Map();
    allAnimals.forEach(a => {
        [a.sireId_public, a.damId_public].filter(Boolean).forEach(parentId => {
            if (!childrenMap.has(parentId)) childrenMap.set(parentId, []);
            childrenMap.get(parentId).push(a.id_public);
        });
    });
    console.log('Total animals loaded for descendant graph:', allAnimals.length);

    const seen = new Set([FOUNDER_ID]);
    const queue = [FOUNDER_ID];
    while (queue.length > 0) {
        const cur = queue.shift();
        const kids = childrenMap.get(cur) || [];
        kids.forEach(kidId => {
            if (seen.has(kidId)) return;
            seen.add(kidId);
            queue.push(kidId);
        });
    }
    console.log(`Founder ${FOUNDER_ID}: ${seen.size} animals (incl. founder) will get the "${LINE_NAME}" line`);

    const assign = profile.animalBreedingLines || {};
    seen.forEach(id => {
        const cur = new Set(assign[id] || []);
        cur.add(lineId);
        assign[id] = Array.from(cur).sort((a, b) => a - b);
    });
    profile.animalBreedingLines = assign;
    profile.markModified('animalBreedingLines');

    await profile.save();
    console.log('Saved.');

    await mongoose.disconnect();
})();
