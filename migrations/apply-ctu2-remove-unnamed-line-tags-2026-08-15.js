// WRITE: strips any line ids whose breedingLineDefs slot has an empty/unnamed name from
// CTU2's animalBreedingLines map (including any added by the ancestor-inheritance propagation
// in apply-ctu2-breeding-line-ancestor-inheritance-2026-08-15.js). Animals left with no lines
// are removed from the map entirely (untagged = absent, matching original convention).
require('dotenv').config();
const mongoose = require('mongoose');
const { PublicProfile } = require('../database/models');

(async () => {
    await mongoose.connect(process.env.MONGODB_URI);
    const profile = await PublicProfile.findOne({ id_public: 'CTU2' });
    if (!profile) { console.log('CTU2 public profile not found'); process.exit(1); }

    const defs = profile.breedingLineDefs || [];
    const unnamedIds = new Set(defs.filter(d => !d.name || !d.name.trim()).map(d => d.id));
    console.log('Unnamed line ids to strip:', Array.from(unnamedIds));

    const assign = profile.animalBreedingLines || {};
    let animalsChanged = 0;
    let removedInstances = 0;
    let animalsRemoved = 0;
    const finalPlain = {};

    for (const [id, lines] of Object.entries(assign)) {
        const kept = lines.filter(l => !unnamedIds.has(l));
        const removedCount = lines.length - kept.length;
        if (removedCount > 0) {
            animalsChanged++;
            removedInstances += removedCount;
        }
        if (kept.length > 0) {
            finalPlain[id] = kept;
        } else if (removedCount > 0) {
            animalsRemoved++;
        }
    }

    console.log('Animals with at least one unnamed-line tag removed:', animalsChanged);
    console.log('Total tag instances removed:', removedInstances);
    console.log('Animals left with zero lines (removed from map entirely):', animalsRemoved);
    console.log('Total animals remaining in map:', Object.keys(finalPlain).length);

    profile.animalBreedingLines = finalPlain;
    profile.markModified('animalBreedingLines');
    await profile.save();
    console.log('Saved.');

    await mongoose.disconnect();
})();
