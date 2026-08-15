// WRITE: full reset + redo of CTU2's breeding-line assignments using a founder-DOWNWARD model
// (a line starts at a founder animal and flows to every descendant), replacing the earlier
// ancestor-upward propagation which was the wrong direction.
// - Wipes animalBreedingLines entirely.
// - Dom Red (Legacy) [0]: CTC46 + all descendants.
// - Brindle (Legacy) [1]: CTC43, CTC260, CTC261 + all descendants (union).
// - Merle (Legacy) [2]: CTC258, CTC259 + all descendants (union).
// - Daikon [5]: CTC20 + all descendants.
// - Legacy star [10]: re-applied to any animal that ends up with all of [0,1,2].
// Merle (New)/Recessive Red/unnamed slots are intentionally left with zero
// assignments - no founders were specified for them in this request.
require('dotenv').config();
const mongoose = require('mongoose');
const { Animal, PublicProfile } = require('../database/models');

const LINE_FOUNDERS = {
    0: ['CTC46'],
    1: ['CTC43', 'CTC260', 'CTC261'],
    2: ['CTC258', 'CTC259'],
    5: ['CTC20'],
};
const LEGACY_LINE_ID = 10;
const TRIPLE_IDS = [0, 1, 2];

(async () => {
    await mongoose.connect(process.env.MONGODB_URI);
    const profile = await PublicProfile.findOne({ id_public: 'CTU2' });
    if (!profile) { console.log('CTU2 public profile not found'); process.exit(1); }

    const allAnimals = await Animal.find({}, 'id_public sireId_public damId_public').lean();
    const childrenMap = new Map();
    allAnimals.forEach(a => {
        [a.sireId_public, a.damId_public].filter(Boolean).forEach(parentId => {
            if (!childrenMap.has(parentId)) childrenMap.set(parentId, []);
            childrenMap.get(parentId).push(a.id_public);
        });
    });
    console.log('Total animals loaded for descendant graph:', allAnimals.length);

    const assign = {};
    const addLine = (id, lineId) => {
        if (!assign[id]) assign[id] = new Set();
        assign[id].add(lineId);
    };

    for (const [lineIdStr, founders] of Object.entries(LINE_FOUNDERS)) {
        const lineId = Number(lineIdStr);
        let totalDescendants = 0;
        founders.forEach(founderId => {
            const seen = new Set([founderId]);
            addLine(founderId, lineId);
            const queue = [founderId];
            while (queue.length > 0) {
                const cur = queue.shift();
                const kids = childrenMap.get(cur) || [];
                kids.forEach(kidId => {
                    if (seen.has(kidId)) return;
                    seen.add(kidId);
                    addLine(kidId, lineId);
                    queue.push(kidId);
                });
            }
            totalDescendants += seen.size;
            console.log(`Line ${lineId} founder ${founderId}: ${seen.size} animals (incl. founder)`);
        });
    }

    let starCount = 0;
    for (const [id, lineSet] of Object.entries(assign)) {
        if (TRIPLE_IDS.every(t => lineSet.has(t))) {
            lineSet.add(LEGACY_LINE_ID);
            starCount++;
        }
    }
    console.log('Animals gaining the Legacy star (all 3 legacy lines):', starCount);

    const finalPlain = {};
    for (const [id, lineSet] of Object.entries(assign)) {
        finalPlain[id] = Array.from(lineSet).sort((a, b) => a - b);
    }

    console.log('Total animals tagged after rebuild:', Object.keys(finalPlain).length);
    console.log('Per-line counts:', TRIPLE_IDS.concat([5, LEGACY_LINE_ID]).map(id => `[${id}]: ${Object.values(finalPlain).filter(a => a.includes(id)).length}`).join(', '));

    profile.animalBreedingLines = finalPlain;
    profile.markModified('animalBreedingLines');
    await profile.save();
    console.log('Saved.');

    await mongoose.disconnect();
})();
