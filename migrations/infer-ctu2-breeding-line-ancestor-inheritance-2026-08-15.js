// DRY RUN (read-only): computes what NEW breeding-line assignments would be added to CTU2's
// PublicProfile.animalBreedingLines if we propagate each currently-tagged animal's line set
// upward to all of its ancestors (via linked sireId_public/damId_public only - manualPedigree
// free-text ancestors are not traceable). Does NOT write anything.
require('dotenv').config();
const mongoose = require('mongoose');
const { Animal, PublicProfile } = require('../database/models');

(async () => {
    await mongoose.connect(process.env.MONGODB_URI);
    const profile = await PublicProfile.findOne({ id_public: 'CTU2' });
    if (!profile) { console.log('CTU2 public profile not found'); process.exit(1); }

    const defs = profile.breedingLineDefs || [];
    const lineName = (id) => defs.find(d => d.id === id)?.name || `(unnamed #${id})`;
    const assign = profile.animalBreedingLines || {};
    const taggedIds = Object.keys(assign);
    console.log('Starting tagged animals:', taggedIds.length);

    // Load the minimal fields needed for the whole reachable ancestor graph, starting from tagged animals.
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
        needed.forEach(id => { if (!byId.has(id)) byId.set(id, null); }); // mark not-found
        const next = [];
        found.forEach(a => {
            if (a.sireId_public) next.push(a.sireId_public);
            if (a.damId_public) next.push(a.damId_public);
        });
        frontier = next;
    }
    console.log('Total distinct animals loaded (incl. ancestors, incl. not-found placeholders):', byId.size);

    // Propagate: for each tagged animal, walk up via sire/dam, unioning its line set into every ancestor.
    const newAssign = {}; // id_public -> Set(lineIds), starts as a clone of existing assign
    Object.keys(assign).forEach(id => { newAssign[id] = new Set(assign[id]); });

    let animalsNotFound = 0;
    for (const id of taggedIds) {
        const lines = assign[id] || [];
        if (lines.length === 0) continue;
        // BFS up the ancestor chain from this animal
        const seen = new Set([id]);
        let queue = [id];
        while (queue.length > 0) {
            const cur = queue.shift();
            const a = byId.get(cur);
            if (!a) { if (cur !== id) animalsNotFound++; continue; }
            [a.sireId_public, a.damId_public].filter(Boolean).forEach(ancestorId => {
                if (seen.has(ancestorId)) return;
                seen.add(ancestorId);
                if (!newAssign[ancestorId]) newAssign[ancestorId] = new Set();
                lines.forEach(l => newAssign[ancestorId].add(l));
                queue.push(ancestorId);
            });
        }
    }

    // Diff against original
    let animalsChanged = 0;
    let totalNewTagInstances = 0;
    const perLineNewCounts = {};
    const sampleChanges = [];
    for (const [id, lineSet] of Object.entries(newAssign)) {
        const before = new Set(assign[id] || []);
        const after = lineSet;
        const added = Array.from(after).filter(l => !before.has(l));
        if (added.length > 0) {
            animalsChanged++;
            totalNewTagInstances += added.length;
            added.forEach(l => { perLineNewCounts[l] = (perLineNewCounts[l] || 0) + 1; });
            if (sampleChanges.length < 25) sampleChanges.push({ id, before: Array.from(before), added });
        }
    }

    console.log('\n=== DRY RUN RESULTS ===');
    console.log('Animals that would gain at least one new line tag:', animalsChanged);
    console.log('Total new (animal, line) tag instances that would be added:', totalNewTagInstances);
    console.log('New tag instances by line:');
    Object.entries(perLineNewCounts).forEach(([lineId, count]) => {
        console.log(`  [${lineId}] ${lineName(Number(lineId))}: +${count}`);
    });
    console.log('\nSample changes (first 25):');
    sampleChanges.forEach(c => console.log(' ', c.id, '| before:', c.before, '| adding:', c.added));
    console.log('\nAncestor lookups that failed (ancestor id referenced but no Animal record found), total occurrences:', animalsNotFound);

    await mongoose.disconnect();
})();
