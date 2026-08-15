require('dotenv').config();
const mongoose = require('mongoose');
const { Animal, User } = require('../database/models');

(async () => {
    await mongoose.connect(process.env.MONGODB_URI);
    const user = await User.findOne({ id_public: 'CTU2' });
    if (!user) { console.log('CTU2 user not found'); process.exit(1); }

    const ctu2Animals = await Animal.find({ creatorId: user._id }, 'id_public name species sireId_public damId_public manualPedigree creatorId').lean();
    console.log('CTU2 animal count:', ctu2Animals.length);

    const speciesCounts = {};
    ctu2Animals.forEach(a => { speciesCounts[a.species] = (speciesCounts[a.species] || 0) + 1; });
    console.log('By species:', JSON.stringify(speciesCounts, null, 2));

    // Build a map of all animals we need (BFS outward from CTU2 animals via sire/dam ids), across ALL owners.
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
        const found = await Animal.find({ id_public: { $in: Array.from(needed) } }, 'id_public name species sireId_public damId_public manualPedigree creatorId').lean();
        found.forEach(a => byId.set(a.id_public, a));
        // Mark any requested-but-not-found ids as null placeholders so we don't re-query them
        needed.forEach(id => { if (!byId.has(id)) byId.set(id, null); });
        frontier = found.map(a => a.id_public);
    }
    console.log('Total distinct animals in full ancestor graph (incl. non-CTU2 owners):', Array.from(byId.values()).filter(Boolean).length);
    console.log('BFS levels traversed:', loops);

    // Union-Find over all known (non-null) animals, linking each animal to its sire/dam (when those are also known records).
    const parentMap = new Map(); // union-find parent pointers, keyed by id_public
    const find = (x) => {
        if (!parentMap.has(x)) parentMap.set(x, x);
        let root = x;
        while (parentMap.get(root) !== root) root = parentMap.get(root);
        // path compression
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

    const clusters = new Map(); // root -> [ids]
    for (const [id, a] of byId.entries()) {
        if (!a) continue;
        const root = find(id);
        if (!clusters.has(root)) clusters.set(root, []);
        clusters.get(root).push(id);
    }
    const clusterArr = Array.from(clusters.values()).sort((a, b) => b.length - a.length);
    console.log('Total distinct clusters (connected components) in full graph:', clusterArr.length);
    console.log('Cluster sizes (largest 20):', clusterArr.slice(0, 20).map(c => c.length));

    // For each of the top clusters, how many are CTU2-owned vs non-CTU2, and species breakdown + a sample founder name.
    clusterArr.slice(0, 15).forEach((c, i) => {
        const ctu2Count = c.filter(id => byId.get(id)?.creatorId?.toString() === user._id.toString()).length;
        const specs = {};
        c.forEach(id => { const sp = byId.get(id)?.species; specs[sp] = (specs[sp] || 0) + 1; });
        // "founders" = animals in this cluster with no sire AND no dam known-in-graph
        const founders = c.filter(id => {
            const a = byId.get(id);
            const sireKnown = a.sireId_public && byId.get(a.sireId_public);
            const damKnown = a.damId_public && byId.get(a.damId_public);
            return !sireKnown && !damKnown;
        });
        console.log(`Cluster #${i + 1}: size=${c.length}, CTU2-owned=${ctu2Count}, species=${JSON.stringify(specs)}, founders=${founders.length} (sample: ${founders.slice(0, 3).map(id => byId.get(id).name).join(', ')})`);
    });

    // How many CTU2 animals have manualPedigree set (i.e. rely on freetext ancestors, not linked records)?
    const withManual = ctu2Animals.filter(a => a.manualPedigree).length;
    console.log('CTU2 animals with manualPedigree set:', withManual);

    await mongoose.disconnect();
})();
