'use strict';
/** READ-ONLY: prints full details of the litters given as args (e.g. node inspect-litters.js CTL1076 CTL1077). */
const L = require('./lib');
const CTLS = process.argv.slice(2).filter((a) => /^CTL\d+$/i.test(a)).map((a) => a.toUpperCase());
(async () => {
  await L.mongoose.connect(process.env.MONGODB_URI);
  const { Litter, Animal } = L.models;
  const ls = await Litter.collection.find({ litter_id_public: { $in: CTLS } }).toArray();
  for (const l of ls) {
    console.log(JSON.stringify({
      _id: l._id, id: l.litter_id_public, creator: l.creatorId, sire: l.sireId_public, dam: l.damId_public,
      mating: l.matingDate, birth: l.birthDate, planned: l.isPlanned, born: l.litterSizeBorn,
      m: l.maleCount, f: l.femaleCount, u: l.unknownCount, offspring: l.offspringIds_public,
      coi: l.inbreedingCoefficient, created: l.createdAt, updated: l.updatedAt, images: (l.images || []).length,
      notes: l.notes, linkedOwners: l.linkedOwners, code: l.breedingPairCodeName, public: l.isDisplayLitter,
    }));
  }
  const ids = ls.flatMap((l) => l.offspringIds_public || []);
  const an = await Animal.collection.find({ id_public: { $in: ids } })
    .project({ id_public: 1, name: 1, litterId: 1, sireId_public: 1, damId_public: 1, birthDate: 1 }).toArray();
  console.log('offspring animals:', JSON.stringify(an));
  const parents = [...new Set(ls.flatMap((l) => [l.sireId_public, l.damId_public]).filter(Boolean))];
  const ps = await Animal.collection.find({ id_public: { $in: parents } }).project({ id_public: 1, breedingRecords: 1 }).toArray();
  console.log('parent breedingRecords:', JSON.stringify(ps.map((a) => ({
    id: a.id_public, br: (a.breedingRecords || []).filter((b) => CTLS.includes(b.litterId)),
  }))));
  await L.mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
