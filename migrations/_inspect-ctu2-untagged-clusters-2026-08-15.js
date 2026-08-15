// READ-ONLY: for CTU2 animals with NO breeding line currently assigned, find their pedigree
// clusters (connected components via sire/dam links, across all owners) so we can see whether
// the untagged animals form consistent groups with an identifiable founder - candidates for
// new breeding lines to create.
require('dotenv').config();
const mongoose = require('mongoose');
const { Animal, PublicProfile, User } = require('../database/models');

(async () => {
    await mongoose.connect(process.env.MONGODB_URI);
    const user = await User.findOne({ id_public: 'CTU2' });
    const profile = await PublicProfile.findOne({ id_public: 'CTU2' });
    if (!user || !profile) { console.log('CTU2 user/profile not found'); process.exit(1); }

    const ctu2Animals = await Animal.find({ creatorId: user._id }, 'id_public name species sireId_public damId_public creatorId').lean();
    console.log('CTU2 animal count:', ctu2Animals.length);

    const assign = profile.animalBreedingLines || {};
    const untagged = ctu2Animals.filter(a => !assign[a.id_public] || assign[a.id_public].length === 0);
    console.log('CTU2 animals with NO breeding line assigned:', untagged.length);

    // Build full ancestor graph (BFS outward via sire/dam ids), across ALL owners.
    const byId = new Map();
    ctu2Animals.forEach(a => byId.set(a.id_public, a));
    let frontier = ctu2Animals.map(a => a.id_public);
    let loops = 0;
    while (frontier.length > 0 && loops < 200) {
        loops++;
        const needed = new Set();
        frontier.forEach(id => {
            const a = byId.get(id);
            if (!a) return;
            if (a.sireId_public && !byId.has(a.sireId_public)) needed.add(a.sireId_public);
            if (a.damId_public && !byId.has(a.damId_public)) needed.add(a.damId_public);
        });
        if (needed.size === 0) break;
        const found = await Animal.find({ id_public: { $in: Array.from(needed) } }, 'id_public name species sireId_public damId_public creatorId').lean();
        found.forEach(a => byId.set(a.id_public, a));
        needed.forEach(id => { if (!byId.has(id)) byId.set(id, null); });
        frontier = found.map(a => a.id_public);
    }
    console.log('Total distinct animals in full ancestor graph:', Array.from(byId.values()).filter(Boolean).length);

    // Union-find over the whole graph, linking each animal to its sire/dam.
    const parentMap = new Map();
    const find = (x) => {
        if (!parentMap.has(x)) parentMap.set(x, x);
        let root = x;
        while (parentMap.get(root) !== root) root = parentMap.get(root);
        let cur = x;
        while (parentMap.get(cur) !== root) { const next = parentMap.get(cur); parentMap.set(cur, root); cur = next; }
        return root;
    };
    const union = (a, b) => {
        const ra = find(a), rb = find(b);
        if (ra !== rb) parentMap.set(ra, rb);
    };
    for (const [id, a] of byId.entries()) {
        if (!a) continue;
        find(id);
        if (a.sireId_public && byId.get(a.sireId_public)) union(id, a.sireId_public);
        if (a.damId_public && byId.get(a.damId_public)) union(id, a.damId_public);
    }

    // Group untagged CTU2 animals by cluster root.
    const clusters = new Map(); // root -> { untaggedIds: [], allIds: [] }
    for (const [id, a] of byId.entries()) {
        if (!a) continue;
        const root = find(id);
        if (!clusters.has(root)) clusters.set(root, { untaggedIds: [], allIds: [] });
        clusters.get(root).allIds.push(id);
    }
    untagged.forEach(a => {
        const root = find(a.id_public);
        clusters.get(root).untaggedIds.push(a.id_public);
    });

    const relevant = Array.from(clusters.values()).filter(c => c.untaggedIds.length > 0);
    relevant.sort((a, b) => b.untaggedIds.length - a.untaggedIds.length);

    console.log('\nClusters containing at least one untagged CTU2 animal:', relevant.length);
    console.log('Total untagged animals accounted for by these clusters:', relevant.reduce((s, c) => s + c.untaggedIds.length, 0));

    relevant.forEach((c, i) => {
        const founders = c.allIds.filter(id => {
            const a = byId.get(id);
            const sireKnown = a.sireId_public && byId.get(a.sireId_public);
            const damKnown = a.damId_public && byId.get(a.damId_public);
            return !sireKnown && !damKnown;
        });
        const existingLinesInCluster = new Set();
        c.allIds.forEach(id => (assign[id] || []).forEach(l => existingLinesInCluster.add(l)));
        const specs = {};
        c.allIds.forEach(id => { const sp = byId.get(id)?.species; specs[sp] = (specs[sp] || 0) + 1; });
        console.log(`\nCluster #${i + 1}: total size=${c.allIds.length}, untagged=${c.untaggedIds.length}, species=${JSON.stringify(specs)}, existing line ids already in cluster=${JSON.stringify(Array.from(existingLinesInCluster))}`);
        console.log('  Founders (no known sire/dam in graph):', founders.map(id => `${id}(${byId.get(id).name})`).join(', ') || '(none found)');
        console.log('  Sample untagged animals:', c.untaggedIds.slice(0, 8).map(id => `${id}(${byId.get(id).name})`).join(', '));
    });

    await mongoose.disconnect();
})();
