'use strict';
/**
 * Merges a duplicate litter into the one being kept:  node merge-dupe-litter.js <KEEP_CTL> <DROP_CTL> [--confirm]
 *  - Both litters must have the same creator, sire and dam (otherwise it aborts).
 *  - KEEP gets the union of offspringIds_public and summed male/female/unknown counts (only when both sides have counts).
 *  - Offspring animals (and PublicAnimal mirrors) pointing at DROP's _id are re-pointed to KEEP's _id.
 *  - DROP is saved to recovery-reports/dropped-litter-<CTL>.json, then deleted.
 * DRY RUN by default; pass --confirm to write.
 */
const L = require('./lib');
const ids = process.argv.slice(2).filter((a) => /^CTL\d+$/i.test(a)).map((a) => a.toUpperCase());
if (ids.length !== 2) { console.error('Usage: node merge-dupe-litter.js <KEEP_CTL> <DROP_CTL> [--confirm]'); process.exit(1); }
const [KEEP, DROP] = ids;

(async () => {
  await L.mongoose.connect(process.env.MONGODB_URI);
  const { Litter, Animal, PublicAnimal } = L.models;
  console.log(L.confirm ? '*** WRITING ***' : '--- DRY RUN (no writes) ---');
  const keep = await Litter.collection.findOne({ litter_id_public: KEEP });
  const drop = await Litter.collection.findOne({ litter_id_public: DROP });
  if (!keep || !drop) throw new Error('Litter not found');
  if (String(keep.creatorId) !== String(drop.creatorId) || keep.sireId_public !== drop.sireId_public || keep.damId_public !== drop.damId_public) {
    throw new Error('Litters differ in creator/sire/dam; refusing to merge');
  }
  const offspring = [...new Set([...(keep.offspringIds_public || []), ...(drop.offspringIds_public || [])])];
  const sum = (k) => (keep[k] != null && drop[k] != null ? keep[k] + drop[k] : keep[k] ?? drop[k]);
  const set = { offspringIds_public: offspring, maleCount: sum('maleCount'), femaleCount: sum('femaleCount'), unknownCount: sum('unknownCount') };
  console.log(`KEEP ${KEEP} <- ${DROP}:`, JSON.stringify(set));

  const moving = await Animal.collection.countDocuments({ litterId: drop._id });
  console.log(`Offspring animals to re-point: ${moving}`);
  if (!L.confirm) { console.log('Re-run with --confirm to apply.'); return L.mongoose.disconnect(); }

  const out = L.path.join(__dirname, '..', '..', '..', 'recovery-reports', `dropped-litter-${DROP}.json`);
  L.fs.writeFileSync(out, JSON.stringify(drop, null, 2));
  console.log('Saved copy of dropped litter to', out);
  await Litter.collection.updateOne({ _id: keep._id }, { $set: set });
  const a = await Animal.collection.updateMany({ litterId: drop._id }, { $set: { litterId: keep._id } });
  const p = await PublicAnimal.collection.updateMany({ litterId: drop._id }, { $set: { litterId: keep._id } });
  await Litter.collection.deleteOne({ _id: drop._id });
  console.log(`Re-pointed ${a.modifiedCount} animals, ${p.modifiedCount} public animals; deleted ${DROP}`);
})().then(() => L.mongoose.disconnect()).catch((e) => { console.error(e); process.exit(1); });
