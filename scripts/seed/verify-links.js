'use strict';
// READ-ONLY verification of animal <-> litter links.
const L = require('./lib');
(async () => {
    await L.mongoose.connect(process.env.MONGODB_URI);
    const d = L.mongoose.connection.db;
    const animals = await d.collection('animals').find({}).project({ id_public: 1, litterId: 1, creatorId: 1, updatedAt: 1 }).toArray();
    const litters = await d.collection('litters').find({}).project({ creatorId: 1, offspringIds_public: 1, tags: 1 }).toArray();
    const lit = new Map(litters.map(l => [String(l._id), l]));
    const linked = animals.filter(a => a.litterId);
    console.log('animals total:', animals.length, '| with litterId:', linked.length, '(expected 541 + 3837 = 4378)');
    console.log('litterId pointing at a missing litter:', linked.filter(a => !lit.has(String(a.litterId))).length);
    console.log('litterId whose litter does not list the animal as offspring:', linked.filter(a => !(lit.get(String(a.litterId)) || { offspringIds_public: [] }).offspringIds_public.includes(a.id_public)).length);
    console.log('owner mismatch animal vs litter:', linked.filter(a => lit.has(String(a.litterId)) && String(lit.get(String(a.litterId)).creatorId) !== String(a.creatorId)).length);
    const orphanLitters = litters.filter(l => !linked.some(a => String(a.litterId) === String(l._id)));
    console.log('litters with no linked animal:', orphanLitters.length);
    const backup = require('fs').existsSync('C:/Projects/merged-backup/backups_auto-backup-2026-11-10T03-00-00_animals.json')
        ? JSON.parse(require('fs').readFileSync('C:/Projects/merged-backup/backups_auto-backup-2026-11-10T03-00-00_animals.json', 'utf8')) : [];
    const bu = new Map(backup.map(a => [String(a._id), a]));
    let tsChanged = 0; animals.forEach(a => { const b = bu.get(String(a._id)); if (b && b.updatedAt && a.updatedAt && new Date(b.updatedAt).getTime() !== new Date(a.updatedAt).getTime()) tsChanged++; });
    console.log('animals whose updatedAt differs from the backup (should be 0):', tsChanged);
    const doc = await L.models.Animal.findOne({ litterId: { $ne: null }, id_public: { $in: ['CTC26'] } }).lean() || await L.models.Animal.findOne({ litterId: { $ne: null } }).lean();
    console.log('mongoose Animal read ok:', !!doc, '| litterId type:', doc && doc.litterId && doc.litterId.constructor.name);
    await L.mongoose.disconnect();
})().catch(e => { console.error(e); process.exit(1); });
