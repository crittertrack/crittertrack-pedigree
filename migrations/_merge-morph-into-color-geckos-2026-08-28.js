// Merges the legacy `morph` field into `color` (displayed as "Morph" for Reptile) for the 4
// knobtail gecko species, mirroring the snake-species merge. Dry-run by default; pass --apply.
require('dotenv').config();
const mongoose = require('mongoose');
const { Animal, PublicAnimal } = require('../database/models');

const GECKO_SPECIES = [
  'Banded Knobtails Gecko', 'Pilbara Knobtail Gecko', '3 Lined Knobtail Gecko', 'Centralian Rough Knobtail Gecko',
];
const APPLY = process.argv.includes('--apply');

const mergeValue = (colorVal, morphVal) => {
  const c = (colorVal || '').trim();
  const m = (morphVal || '').trim();
  if (!m) return c;
  if (!c) return m;
  if (c.toLowerCase() === m.toLowerCase()) return c;
  return `${c}, ${m}`;
};

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);

  for (const Model of [Animal, PublicAnimal]) {
    console.log(`\n--- ${Model.modelName} (${APPLY ? 'APPLY' : 'DRY RUN'}) ---`);
    const docs = await Model.find({ species: { $in: GECKO_SPECIES } }, { _id: 1, name: 1, species: 1, color: 1, morph: 1 }).lean();

    let changed = 0;
    for (const doc of docs) {
      const merged = mergeValue(doc.color, doc.morph);
      const colorChanged = merged !== (doc.color || '');
      const morphChanged = !!doc.morph;
      if (!colorChanged && !morphChanged) continue;

      changed++;
      console.log({ id: String(doc._id), name: doc.name, species: doc.species, before: { color: doc.color, morph: doc.morph }, after: { color: merged, morph: null } });

      if (APPLY) {
        await Model.collection.updateOne({ _id: doc._id }, { $set: { color: merged, morph: null } });
      }
    }
    console.log(`${Model.modelName}: ${changed}/${docs.length} docs changed.`);
  }

  await mongoose.disconnect();
})();
