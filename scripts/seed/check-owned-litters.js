'use strict';
// READ-ONLY: users.ownedLitters ids (from the 11-10 backup) vs the litters now in the database.
const L = require('./lib');
(async () => {
    await L.mongoose.connect(process.env.MONGODB_URI);
    const d = L.mongoose.connection.db;
    const users = L.load('users');
    const have = new Set((await d.collection('litters').find({}).project({ _id: 1 }).toArray()).map(x => String(x._id)));
    const owned = new Map();
    users.forEach(u => (u.ownedLitters || []).forEach(l => { const k = String(l); if (!owned.has(k)) owned.set(k, []); owned.get(k).push(u.id_public); }));
    const unresolved = [...owned.keys()].filter(k => !have.has(k));
    console.log('ownedLitters unique ids in backup:', owned.size);
    console.log('  now exist as a litter (restored from animal links):', owned.size - unresolved.length);
    console.log('  still NOT in the litters collection:', unresolved.length);
    const byOwner = {}; unresolved.forEach(k => owned.get(k).forEach(o => { byOwner[o] = (byOwner[o] || 0) + 1; }));
    console.log('  by owner (top 8):', JSON.stringify(Object.entries(byOwner).sort((a, b) => b[1] - a[1]).slice(0, 8)));
    console.log('  owners affected:', Object.keys(byOwner).length);
    // How many unresolved ids are consecutive ObjectId runs (created in one batch, e.g. an import)?
    const t = unresolved.map(k => parseInt(k.slice(0, 8), 16)).sort((a, b) => a - b);
    console.log('  creation dates span:', new Date(t[0] * 1000).toISOString().slice(0, 10), '->', new Date(t[t.length - 1] * 1000).toISOString().slice(0, 10));
    const days = {}; unresolved.forEach(k => { const dd = new Date(parseInt(k.slice(0, 8), 16) * 1000).toISOString().slice(0, 10); days[dd] = (days[dd] || 0) + 1; });
    console.log('  busiest creation days:', JSON.stringify(Object.entries(days).sort((a, b) => b[1] - a[1]).slice(0, 5)));
    const animals = L.load('animals');
    const withDates = animals.filter(a => a.isPregnant || a.isNursing || a.isInMating || a.isPlannedMating).length;
    console.log('  animals currently flagged pregnant/nursing/mating/planned:', withDates);
    await L.mongoose.disconnect();
})().catch(e => { console.error(e); process.exit(1); });
