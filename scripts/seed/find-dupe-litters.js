'use strict';
/**
 * READ-ONLY: finds likely duplicate litters = same creator + sire + dam + same birth day
 * (planned/unborn litters are grouped by sire + dam + mating day, or sire + dam when no mating date).
 * Prints each group with offspring, counts and public flag. Writes nothing.
 */
const L = require('./lib');
const day = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null);
(async () => {
  await L.mongoose.connect(process.env.MONGODB_URI);
  const { Litter } = L.models;
  const litters = await Litter.collection.find({})
    .project({ litter_id_public: 1, creatorId: 1, sireId_public: 1, damId_public: 1, birthDate: 1, matingDate: 1, isPlanned: 1,
      offspringIds_public: 1, maleCount: 1, femaleCount: 1, unknownCount: 1, litterSizeBorn: 1, isDisplayLitter: 1, notes: 1 }).toArray();
  const groups = new Map();
  for (const l of litters) {
    if (!l.sireId_public || !l.damId_public) continue;
    const born = day(l.birthDate);
    const key = [String(l.creatorId), l.sireId_public, l.damId_public, born ? `born ${born}` : `unborn ${day(l.matingDate) || 'no-mating-date'}`].join(' | ');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(l);
  }
  const dupes = [...groups.entries()].filter(([, v]) => v.length > 1);
  console.log(`Scanned ${litters.length} litters; ${dupes.length} duplicate group(s)`);
  for (const [key, v] of dupes.sort((a, b) => a[1][0].litter_id_public.localeCompare(b[1][0].litter_id_public, undefined, { numeric: true }))) {
    console.log(`\n${key}`);
    v.sort((a, b) => a.litter_id_public.localeCompare(b.litter_id_public, undefined, { numeric: true })).forEach((l) => console.log(
      `  ${l.litter_id_public} offspring=[${(l.offspringIds_public || []).join(',')}] M/F/U=${l.maleCount ?? '-'}/${l.femaleCount ?? '-'}/${l.unknownCount ?? '-'} size=${l.litterSizeBorn ?? '-'} public=${!!l.isDisplayLitter} planned=${!!l.isPlanned}`));
  }
  await L.mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
