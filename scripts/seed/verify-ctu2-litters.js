'use strict';
// READ-ONLY. Verifies the CTL1997-CTL2014 litters and the parents' reproductive flags.
const L = require('./lib');
(async () => {
  await L.mongoose.connect(process.env.MONGODB_URI);
  const { Animal, Litter, User } = L.models;
  const owner = await User.collection.findOne({ id_public: 'CTU2' }, { projection: { _id: 1, ownedLitters: 1 } });
  const ids = Array.from({ length: 18 }, (_, i) => 'CTL' + (1997 + i));
  const litters = await Litter.collection.find({ litter_id_public: { $in: ids } }).sort({ litter_id_public: 1 }).toArray();
  console.log('litters found:', litters.length, '| all owned by CTU2:', litters.every(l => String(l.creatorId) === String(owner._id)),
    '| linked in user.ownedLitters:', litters.filter(l => (owner.ownedLitters || []).some(x => String(x) === String(l._id))).length);
  console.log('planned:', litters.filter(l => l.isPlanned).map(l => l.litter_id_public).join(','), '| mated:', litters.filter(l => !l.isPlanned).length);
  const parents = [...new Set(litters.flatMap(l => [l.sireId_public, l.damId_public]))];
  const animals = await Animal.collection.find({ id_public: { $in: parents } }).project({ id_public: 1, prefix: 1, name: 1, isInMating: 1, isPlannedMating: 1, isPregnant: 1 }).toArray();
  const byId = Object.fromEntries(animals.map(a => [a.id_public, a]));
  const wrong = litters.filter(l => [l.sireId_public, l.damId_public].some(p => l.isPlanned ? !byId[p].isPlannedMating : !byId[p].isInMating));
  console.log('parents:', parents.length, '| litters whose parents have the expected flag:', litters.length - wrong.length, '/', litters.length);
  wrong.forEach(l => console.log('  MISMATCH', l.litter_id_public, l.sireId_public, l.damId_public));
  // Toetie and the animals in the 3 unsure planned pairings
  const chk = await Animal.collection.find({ creatorId_public: 'CTU2', id_public: { $in: ['CTC7688', 'CTC6177', 'CTC7773', 'CTC5484', 'CTC6261'] } })
    .project({ id_public: 1, prefix: 1, name: 1, isInMating: 1, isPlannedMating: 1 }).toArray();
  console.log('unsure-planned animals now:'); chk.forEach(a => console.log('  ', a.id_public, [a.prefix, a.name].filter(Boolean).join(' '), 'InMating=' + !!a.isInMating, 'Planned=' + !!a.isPlannedMating));
  const total = await Animal.collection.countDocuments({ creatorId_public: 'CTU2', $or: [{ isInMating: true }, { isPlannedMating: true }] });
  console.log('CTU2 animals flagged InMating/Planned now:', total, '(was 35)');
  await L.mongoose.disconnect();
})().catch(e => { console.error(e.message); process.exit(1); });
