require('dotenv').config();
const mongoose = require('mongoose');
const { Animal, User } = require('../database/models');

(async () => {
    await mongoose.connect(process.env.MONGODB_URI);
    const user = await User.findOne({ id_public: 'CTU2' });

    // Rebuild cluster #2 by BFS from its known founders, following both parent and child links.
    const founders = ['CTC2920', 'CTC3017', 'CTC3132', 'CTC3133'];
    const byId = new Map();
    const load = async (ids) => {
        const missing = ids.filter(id => !byId.has(id));
        if (missing.length === 0) return;
        const found = await Animal.find({ id_public: { $in: missing } }, 'id_public name creatorId sireId_public damId_public').lean();
        found.forEach(a => byId.set(a.id_public, a));
        missing.forEach(id => { if (!byId.has(id)) byId.set(id, null); });
    };
    await load(founders);
    let frontier = founders.slice();
    let loops = 0;
    while (frontier.length && loops < 50) {
        loops++;
        const children = await Animal.find({ $or: [{ sireId_public: { $in: frontier } }, { damId_public: { $in: frontier } }] }, 'id_public name creatorId sireId_public damId_public').lean();
        const newIds = children.map(c => c.id_public).filter(id => !byId.has(id));
        children.forEach(c => byId.set(c.id_public, c));
        const parentIds = new Set();
        frontier.forEach(id => {
            const a = byId.get(id);
            if (a?.sireId_public) parentIds.add(a.sireId_public);
            if (a?.damId_public) parentIds.add(a.damId_public);
        });
        const newParents = Array.from(parentIds).filter(id => !byId.has(id));
        await load(newParents);
        frontier = newIds.concat(newParents);
    }

    const all = Array.from(byId.values()).filter(Boolean);
    console.log('Total animals found in cluster:', all.length);
    all.forEach(a => {
        const owner = a.creatorId?.toString() === user._id.toString() ? 'CTU2' : 'OTHER';
        console.log(a.id_public, '|', a.name, '|', owner, '| sire:', a.sireId_public, '| dam:', a.damId_public);
    });

    await mongoose.disconnect();
})();
