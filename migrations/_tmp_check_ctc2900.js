require('dotenv').config();
const mongoose = require('mongoose');
const { Animal, User } = require('../database/models');

(async () => {
    await mongoose.connect(process.env.MONGODB_URI);
    const user = await User.findOne({ id_public: 'CTU2' });

    const target = await Animal.findOne({ id_public: 'CTC2900' }, 'id_public name creatorId isOwned sireId_public damId_public').lean();
    if (!target) { console.log('CTC2900 not found'); process.exit(1); }
    const owner = target.creatorId?.toString() === user._id.toString() ? 'CTU2' : 'OTHER';
    console.log('CTC2900:', target.name, '| owner:', owner, '| isOwned:', target.isOwned, '| sire:', target.sireId_public, '| dam:', target.damId_public);

    // BFS the whole connected pedigree cluster (both directions: ancestors and descendants).
    const byId = new Map();
    const load = async (ids) => {
        const missing = ids.filter(id => !byId.has(id));
        if (missing.length === 0) return;
        const found = await Animal.find({ id_public: { $in: missing } }, 'id_public name creatorId isOwned sireId_public damId_public').lean();
        found.forEach(a => byId.set(a.id_public, a));
        missing.forEach(id => { if (!byId.has(id)) byId.set(id, null); });
    };
    await load(['CTC2900']);
    let frontier = ['CTC2900'];
    let loops = 0;
    while (frontier.length && loops < 100) {
        loops++;
        const parentIds = new Set();
        frontier.forEach(id => {
            const a = byId.get(id);
            if (a?.sireId_public) parentIds.add(a.sireId_public);
            if (a?.damId_public) parentIds.add(a.damId_public);
        });
        const newParents = Array.from(parentIds).filter(id => !byId.has(id));
        await load(newParents);

        const children = await Animal.find({ $or: [{ sireId_public: { $in: frontier } }, { damId_public: { $in: frontier } }] }, 'id_public name creatorId isOwned sireId_public damId_public').lean();
        const newChildren = children.map(c => c.id_public).filter(id => !byId.has(id));
        children.forEach(c => byId.set(c.id_public, c));

        frontier = newParents.concat(newChildren);
    }

    const all = Array.from(byId.values()).filter(Boolean);
    console.log('\nTotal animals in CTC2900\'s connected pedigree cluster:', all.length);

    const ctu2Owned = all.filter(a => a.creatorId?.toString() === user._id.toString() && a.isOwned);
    console.log('CTU2-owned AND isOwned:true animals in this cluster:', ctu2Owned.length);
    ctu2Owned.forEach(a => console.log(' ', a.id_public, a.name));

    const ctu2NotOwned = all.filter(a => a.creatorId?.toString() === user._id.toString() && !a.isOwned);
    console.log('\nCTU2-owned but isOwned:false (transferred away) animals in this cluster:', ctu2NotOwned.length);
    ctu2NotOwned.forEach(a => console.log(' ', a.id_public, a.name));

    await mongoose.disconnect();
})();
