'use strict';
// READ-ONLY. Verifies the 5 planned CTU2 litters (CTL2013-CTL2017) and every parent's flags.
const L = require('./lib');
(async () => {
  await L.mongoose.connect(process.env.MONGODB_URI);
  const { Animal, Litter, User } = L.models;
  const u = await User.collection.findOne({ id_public: 'CTU2' }, { projection: { _id: 1, ownedLitters: 1 } });
  const ids = ['CTL2013', 'CTL2014', 'CTL2015', 'CTL2016', 'CTL2017'];
  const rows = await Litter.collection.find({ litter_id_public: { $in: ids } }).sort({ litter_id_public: 1 }).toArray();
  for (const l of rows) {
    console.log(l.litter_id_public, l.sireId_public, 'x', l.damId_public, 'planned=' + l.isPlanned,
      'mating=' + l.matingDate.toISOString().slice(0, 10), 'due=' + l.expectedDueDate.toISOString().slice(0, 10),
      'owner CTU2=' + (String(l.creatorId) === String(u._id)), 'linked=' + u.ownedLitters.some(x => String(x) === String(l._id)));
  }
  const all = await Litter.collection.find({ litter_id_public: { $in: Array.from({ length: 21 }, (_, i) => 'CTL' + (1997 + i)) } }).toArray();
  console.log('total seeded litters:', all.length, '| planned:', all.filter(l => l.isPlanned).length, '| mated:', all.filter(l => !l.isPlanned).length);
  const parents = [...new Set(all.flatMap(l => [l.sireId_public, l.damId_public]))];
  const animals = await Animal.collection.find({ id_public: { $in: parents } }).project({ id_public: 1, isInMating: 1, isPlannedMating: 1 }).toArray();
  const byId = Object.fromEntries(animals.map(a => [a.id_public, a]));
  // Expected: an animal shows planned if it has a planned litter, otherwise in-mating (newest litter wins).
  const hasPlanned = new Set(all.filter(l => l.isPlanned).flatMap(l => [l.sireId_public, l.damId_public]));
  const bad = parents.filter(p => hasPlanned.has(p) ? !byId[p].isPlannedMating : !byId[p].isInMating);
  console.log('parents:', parents.length, '| flags as expected:', parents.length - bad.length, '/', parents.length, bad.length ? 'BAD: ' + bad.join(',') : '');
  const flagged = await Animal.collection.countDocuments({ creatorId_public: 'CTU2', $or: [{ isInMating: true }, { isPlannedMating: true }] });
  console.log('CTU2 animals flagged InMating/Planned:', flagged, '(originally 35)');
  await L.mongoose.disconnect();
})().catch(e => { console.error(e.message); process.exit(1); });
