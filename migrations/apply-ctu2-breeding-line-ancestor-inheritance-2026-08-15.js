// WRITE: propagates each CTU2-tagged animal's breeding-line set upward through its linked
// sire/dam ancestors (merging into whatever lines that ancestor already has). Mirrors the
// dry-run logic in infer-ctu2-breeding-line-ancestor-inheritance-2026-08-15.js exactly.
// Only writes to CTU2's own PublicProfile.animalBreedingLines map - does not touch the
// underlying Animal records, so it has no effect on any other user's view.
require('dotenv').config();
const mongoose = require('mongoose');
const { Animal, PublicProfile } = require('../database/models');

(async () => {
    await mongoose.connect(process.env.MONGODB_URI);
    const profile = await PublicProfile.findOne({ id_public: 'CTU2' });
    if (!profile) { console.log('CTU2 public profile not found'); process.exit(1); }

    const assign = profile.animalBreedingLines || {};
    const taggedIds = Object.keys(assign);
    console.log('Starting tagged animals:', taggedIds.length);

    const byId = new Map();
    let frontier = taggedIds.slice();
    let loops = 0;
    while (frontier.length > 0 && loops < 200) {
        loops++;
        const needed = new Set();
        frontier.forEach(id => { if (!byId.has(id)) needed.add(id); });
        if (needed.size === 0) break;
        const found = await Animal.find({ id_public: { $in: Array.from(needed) } }, 'id_public sireId_public damId_public').lean();
        found.forEach(a => byId.set(a.id_public, a));
        needed.forEach(id => { if (!byId.has(id)) byId.set(id, null); });
        const next = [];
        found.forEach(a => {
            if (a.sireId_public) next.push(a.sireId_public);
            if (a.damId_public) next.push(a.damId_public);
        });
        frontier = next;
    }
    console.log('Total distinct animals loaded (incl. ancestors):', byId.size);

    const newAssign = {};
    Object.keys(assign).forEach(id => { newAssign[id] = new Set(assign[id]); });

    for (const id of taggedIds) {
        const lines = assign[id] || [];
        if (lines.length === 0) continue;
        const seen = new Set([id]);
        let queue = [id];
        while (queue.length > 0) {
            const cur = queue.shift();
            const a = byId.get(cur);
            if (!a) continue;
            [a.sireId_public, a.damId_public].filter(Boolean).forEach(ancestorId => {
                if (seen.has(ancestorId)) return;
                seen.add(ancestorId);
                if (!newAssign[ancestorId]) newAssign[ancestorId] = new Set();
                lines.forEach(l => newAssign[ancestorId].add(l));
                queue.push(ancestorId);
            });
        }
    }

    let animalsChanged = 0;
    let totalNewTagInstances = 0;
    const finalPlain = {};
    for (const [id, lineSet] of Object.entries(newAssign)) {
        const before = new Set(assign[id] || []);
        const after = Array.from(lineSet).sort((a, b) => a - b);
        finalPlain[id] = after;
        const added = after.filter(l => !before.has(l));
        if (added.length > 0) {
            animalsChanged++;
            totalNewTagInstances += added.length;
        }
    }

    console.log('Animals gaining at least one new line tag:', animalsChanged);
    console.log('Total new (animal, line) tag instances added:', totalNewTagInstances);

    profile.animalBreedingLines = finalPlain;
    profile.markModified('animalBreedingLines');
    await profile.save();
    console.log('Saved. Total animals now tagged:', Object.keys(finalPlain).length);

    await mongoose.disconnect();
})();
