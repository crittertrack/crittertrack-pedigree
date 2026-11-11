'use strict';
// READ-ONLY. Lists animals created by CTU2 flagged isInMating and/or isPlannedMating. Writes nothing.
const L = require('./lib');
(async () => {
  await L.mongoose.connect(process.env.MONGODB_URI);
  const c = L.models.Animal.collection;
  const base = { creatorId_public: 'CTU2' };
  const total = await c.countDocuments(base);
  const rows = await c.find({ ...base, $or: [{ isInMating: true }, { isPlannedMating: true }] })
    .project({ id_public: 1, name: 1, prefix: 1, species: 1, gender: 1, isInMating: 1, isPlannedMating: 1, archived: 1 })
    .sort({ id_public: 1 }).toArray();
  console.log('CTU2 animals total:', total, '| flagged:', rows.length);
  console.log('isInMating:', rows.filter(r => r.isInMating).length,
    '| isPlannedMating:', rows.filter(r => r.isPlannedMating).length,
    '| both:', rows.filter(r => r.isInMating && r.isPlannedMating).length);
  for (const r of rows) {
    console.log([r.id_public, [r.prefix, r.name].filter(Boolean).join(' '), r.species, r.gender,
      r.isInMating ? 'InMating' : '', r.isPlannedMating ? 'PlannedMating' : '', r.archived ? '(archived)' : ''].join(' | '));
  }
  await L.mongoose.disconnect();
})().catch(e => { console.error(e.message); process.exit(1); });
