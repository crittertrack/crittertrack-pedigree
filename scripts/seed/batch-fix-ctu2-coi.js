'use strict';
/**
 * Batch (re)computes and caches the COI (inbreedingCoefficient) for every CTU2 animal and litter,
 * so opening the litter/animal views reads a stored value instead of calculating on load.
 *
 *  - Animals: same math as GET /api/animals/:id/inbreeding (calculateInbreedingCoefficient, 50 generations, 2 dp).
 *  - Litters: same math as the litter editor's pairing preview (sire x dam, 20 generations).
 *  - Pedigree data is preloaded into memory in a few batched queries, so the calculation does no per-ancestor DB calls.
 *  - Writes only $set inbreedingCoefficient (no hooks, updatedAt untouched). Also syncs matching PublicAnimal docs.
 *
 * DRY RUN by default (reads only). Pass --confirm to write.
 * Every value is recomputed; only missing/changed ones are written.
 */
const L = require('./lib');
const {
  calculateInbreedingCoefficient,
  calculatePairingInbreeding,
} = require('../../utils/inbreeding');

const OWNER = 'CTU2';
const ANIMAL_GENERATIONS = 50;
const LITTER_GENERATIONS = 20;
const FIELDS = { id_public: 1, sireId_public: 1, damId_public: 1, inbreedingCoefficient: 1 };

(async () => {
  await L.mongoose.connect(process.env.MONGODB_URI);
  const { Animal, PublicAnimal, Litter, User } = L.models;
  console.log(L.confirm ? '*** WRITING ***' : '--- DRY RUN (no writes) ---');

  const owner = await User.collection.findOne({ id_public: OWNER }, { projection: { _id: 1 } });
  if (!owner) throw new Error(`${OWNER} user not found`);

  const animals = await Animal.collection.find({ creatorId_public: OWNER }).project(FIELDS).toArray();
  const litters = await Litter.collection
    .find({ creatorId: owner._id })
    .project({ litter_id_public: 1, sireId_public: 1, damId_public: 1, inbreedingCoefficient: 1 }).toArray();
  console.log(`Loaded ${animals.length} ${OWNER} animals, ${litters.length} ${OWNER} litters`);

  // ---- Preload the pedigree (BFS up through sires/dams, including other owners' ancestors) ----
  const cache = new Map(); // id_public -> { sireId_public, damId_public } | null
  animals.forEach((a) => cache.set(a.id_public, a));
  let frontier = new Set();
  const enqueue = (a) => {
    for (const p of [a && a.sireId_public, a && a.damId_public]) if (p && !cache.has(p)) frontier.add(p);
  };
  animals.forEach(enqueue);
  litters.forEach((l) => enqueue({ sireId_public: l.sireId_public, damId_public: l.damId_public }));
  let rounds = 0;
  while (frontier.size) {
    rounds++;
    const ids = [...frontier];
    frontier = new Set();
    const found = new Map();
    for (let i = 0; i < ids.length; i += 500) {
      const chunk = ids.slice(i, i + 500);
      for (const Model of [Animal, PublicAnimal]) {
        const docs = await Model.collection.find({ id_public: { $in: chunk } }).project(FIELDS).toArray();
        docs.forEach((d) => { if (!found.has(d.id_public)) found.set(d.id_public, d); });
      }
    }
    ids.forEach((id) => cache.set(id, found.get(id) || null)); // null = unknown ancestor, stops that branch
    found.forEach(enqueue);
  }
  console.log(`Pedigree preloaded: ${cache.size} animals in ${rounds} batched round(s)`);
  const fetchAnimal = async (id) => cache.get(id) || null;

  const round = (n, dp) => parseFloat(Number(n).toFixed(dp));
  const same = (a, b) => a != null && b != null && Math.abs(a - b) < 1e-9;

  // ---- Animals ----
  const animalOps = [], publicOps = [];
  let aErr = 0, aNull = 0, aChanged = 0, aOk = 0;
  for (const a of animals) {
    try {
      const coi = round(await calculateInbreedingCoefficient(a.id_public, fetchAnimal, ANIMAL_GENERATIONS), 2);
      if (same(a.inbreedingCoefficient, coi)) { aOk++; continue; }
      a.inbreedingCoefficient == null ? aNull++ : aChanged++;
      animalOps.push({ updateOne: { filter: { _id: a._id }, update: { $set: { inbreedingCoefficient: coi } } } });
      publicOps.push({ updateMany: { filter: { id_public: a.id_public }, update: { $set: { inbreedingCoefficient: coi } } } });
    } catch (e) { aErr++; console.log(`ERROR animal ${a.id_public}: ${e.message}`); }
  }
  console.log(`Animals: up to date ${aOk} | missing ${aNull} | changed ${aChanged} | errors ${aErr}`);

  // ---- Litters ----
  const litterOps = [];
  let lErr = 0, lNull = 0, lChanged = 0, lOk = 0, lNoParents = 0;
  for (const l of litters) {
    if (!l.sireId_public || !l.damId_public) { lNoParents++; continue; }
    try {
      const coi = await calculatePairingInbreeding(l.sireId_public, l.damId_public, fetchAnimal, LITTER_GENERATIONS);
      if (same(l.inbreedingCoefficient, coi)) { lOk++; continue; }
      l.inbreedingCoefficient == null ? lNull++ : lChanged++;
      litterOps.push({ updateOne: { filter: { _id: l._id }, update: { $set: { inbreedingCoefficient: coi } } } });
    } catch (e) { lErr++; console.log(`ERROR litter ${l.litter_id_public}: ${e.message}`); }
  }
  console.log(`Litters: up to date ${lOk} | missing ${lNull} | changed ${lChanged} | no both parents ${lNoParents} | errors ${lErr}`);

  if (L.confirm) {
    for (let i = 0; i < animalOps.length; i += 500) await Animal.collection.bulkWrite(animalOps.slice(i, i + 500), { ordered: false });
    for (let i = 0; i < publicOps.length; i += 500) await PublicAnimal.collection.bulkWrite(publicOps.slice(i, i + 500), { ordered: false });
    for (let i = 0; i < litterOps.length; i += 500) await Litter.collection.bulkWrite(litterOps.slice(i, i + 500), { ordered: false });
    console.log(`Wrote: ${animalOps.length} animals, ${litterOps.length} litters`);
  } else {
    console.log(`Would write: ${animalOps.length} animals, ${litterOps.length} litters (re-run with --confirm)`);
  }
  await L.mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
