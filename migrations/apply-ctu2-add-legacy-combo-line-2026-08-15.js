// WRITE (dev-only exception): adds an 11th breeding-line slot to CTU2's PublicProfile —
// a "Legacy" combo line (gradient color, rendered as a star instead of a diamond by the
// frontend's breedingLineColor util) — and assigns it to every animal that currently
// carries all three of Dom Red (Legacy) [0], Brindle (Legacy) [1], and Merle (Legacy) [2].
require('dotenv').config();
const mongoose = require('mongoose');
const { PublicProfile } = require('../database/models');

const LEGACY_LINE_ID = 10;
const LEGACY_LINE_COLOR = 'linear-gradient(90deg, #ef4444, #eab308)';
const TRIPLE_IDS = [0, 1, 2];

(async () => {
    await mongoose.connect(process.env.MONGODB_URI);
    const profile = await PublicProfile.findOne({ id_public: 'CTU2' });
    if (!profile) { console.log('CTU2 public profile not found'); process.exit(1); }

    const defs = profile.breedingLineDefs || [];
    if (defs.some(d => d.id === LEGACY_LINE_ID)) {
        console.log(`Line id ${LEGACY_LINE_ID} already exists, aborting.`);
        process.exit(1);
    }
    defs.push({ id: LEGACY_LINE_ID, name: 'Legacy', color: LEGACY_LINE_COLOR, enabled: true });

    const assign = profile.animalBreedingLines || {};
    let matched = 0;
    for (const [id, lines] of Object.entries(assign)) {
        if (TRIPLE_IDS.every(t => lines.includes(t)) && !lines.includes(LEGACY_LINE_ID)) {
            assign[id] = [...lines, LEGACY_LINE_ID];
            matched++;
        }
    }

    console.log('Animals matching all of Dom Red/Brindle/Merle (Legacy), gaining the new Legacy line:', matched);

    profile.breedingLineDefs = defs;
    profile.animalBreedingLines = assign;
    profile.markModified('breedingLineDefs');
    profile.markModified('animalBreedingLines');
    await profile.save();
    console.log('Saved.');

    await mongoose.disconnect();
})();
