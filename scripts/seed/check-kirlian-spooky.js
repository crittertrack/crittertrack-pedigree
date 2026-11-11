'use strict';
// READ-ONLY. Shows every litter involving Kirlian (CTC7659) or Spooky (CTC6261), plus basic animal info.
const L = require('./lib');
(async () => {
  await L.mongoose.connect(process.env.MONGODB_URI);
  const { Animal, Litter } = L.models;
  const ids = ['CTC7659', 'CTC6261'];
  const animals = await Animal.collection.find({ id_public: { $in: ids } })
    .project({ id_public: 1, prefix: 1, name: 1, gender: 1, species: 1, isInMating: 1, isPlannedMating: 1, isPregnant: 1, isNursing: 1, dateOfBirth: 1, birthDate: 1, status: 1 }).toArray();
  animals.forEach(a => console.log(JSON.stringify(a)));
  const litters = await Litter.collection.find({ $or: [{ sireId_public: { $in: ids } }, { damId_public: { $in: ids } }] })
    .project({ litter_id_public: 1, sireId_public: 1, damId_public: 1, matingDate: 1, isPlanned: 1, birthDate: 1 }).sort({ litter_id_public: 1 }).toArray();
  console.log('litters involving either:', litters.length);
  litters.forEach(l => console.log(' ', l.litter_id_public, l.sireId_public, 'x', l.damId_public, l.matingDate ? new Date(l.matingDate).toISOString().slice(0, 10) : '-', l.isPlanned ? 'planned' : '', l.birthDate ? 'born ' + new Date(l.birthDate).toISOString().slice(0, 10) : ''));
  await L.mongoose.disconnect();
})().catch(e => { console.error(e.message); process.exit(1); });
