// READ-ONLY: same clustering as _inspect-ctu2-untagged-clusters, but adds per-cluster
// generation depth (longest founder->descendant chain) and founder ownership, to help decide
// which untagged clusters are real multi-generation lineages worth naming as new lines vs
// shallow one-generation groups.
require('dotenv').config();
const mongoose = require('mongoose');
const { Animal, PublicProfile, User } = require('../database/models');

(async () => {
    await mongoose.connect(process.env.MONGODB_URI);
    const user = await User.findOne({ id_public: 'CTU2' });
    const profile = await PublicProfile.findOne({ id_public: 'CTU2' });
    if (!user || !profile) { console.log('CTU2 user/profile not found'); process.exit(1); }

    const ctu2Animals = await Animal.find({ creatorId: user._id }, 'id_public name species sireId_public damId_public creatorId').lean();
    const assign = profile.animalBreedingLines || {};
    const untagged = ctu2Animals.filter(a => !assign[a.id_public] || assign[a.id_public].length === 0);

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

    const clusters = new Map();
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

    const depthCache = new Map();
    const depthOf = (id, clusterSet, visiting = new Set()) => {
        if (depthCache.has(id)) return depthCache.get(id);
        if (visiting.has(id)) return 0; // guard against any accidental cycle
        visiting.add(id);
        const a = byId.get(id);
        const sireD = (a?.sireId_public && clusterSet.has(a.sireId_public)) ? depthOf(a.sireId_public, clusterSet, visiting) : -1;
        const damD = (a?.damId_public && clusterSet.has(a.damId_public)) ? depthOf(a.damId_public, clusterSet, visiting) : -1;
        const d = (sireD === -1 && damD === -1) ? 0 : Math.max(sireD, damD) + 1;
        depthCache.set(id, d);
        return d;
    };

    relevant.forEach((c, i) => {
        const clusterSet = new Set(c.allIds);
        const founders = c.allIds.filter(id => {
            const a = byId.get(id);
            const sireKnown = a.sireId_public && byId.get(a.sireId_public);
            const damKnown = a.damId_public && byId.get(a.damId_public);
            return !sireKnown && !damKnown;
        });
        const maxDepth = Math.max(...c.allIds.map(id => depthOf(id, clusterSet)));
        const founderOwners = founders.map(id => byId.get(id).creatorId?.toString() === user._id.toString() ? 'CTU2' : 'other');
        const ctu2FounderCount = founderOwners.filter(o => o === 'CTU2').length;
        console.log(`Cluster #${i + 1}: total=${c.allIds.length}, untagged=${c.untaggedIds.length}, generations(depth+1)=${maxDepth + 1}, founders=${founders.length} (CTU2-owned: ${ctu2FounderCount}, other: ${founders.length - ctu2FounderCount})`);
    });

    await mongoose.disconnect();
})();
