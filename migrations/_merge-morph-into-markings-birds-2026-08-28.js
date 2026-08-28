// Merges the legacy `morph` field into `markings` (displayed as "Plumage Pattern") for Bird
// species, since the UI now hides the separate Morph field for birds. Dry-run by default;
// pass --apply to write changes.
//
// Merge rule per doc: if morph is empty -> leave markings untouched. If markings is empty ->
// markings = morph. If both have (different) values -> concatenate as "markings, morph".
// After merging, morph is cleared to null for these species.
require('dotenv').config();
const mongoose = require('mongoose');
const { Animal, PublicAnimal } = require('../database/models');

const BIRD_SPECIES = [
  'African Grey Parrot', 'Budgie', 'Canary', 'Cockatiel', 'Cockatoo',
  'Conure', 'Dove', 'Lovebird', 'Macaw', 'Zebra Finch',
];
const APPLY = process.argv.includes('--apply');

const mergeValue = (markingsVal, morphVal) => {
  const mk = (markingsVal || '').trim();
  const mo = (morphVal || '').trim();
  if (!mo) return mk;
  if (!mk) return mo;
  if (mk.toLowerCase() === mo.toLowerCase()) return mk;
  return `${mk}, ${mo}`;
};

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);

  for (const Model of [Animal, PublicAnimal]) {
    console.log(`\n--- ${Model.modelName} (${APPLY ? 'APPLY' : 'DRY RUN'}) ---`);
    const docs = await Model.find({ species: { $in: BIRD_SPECIES } }, { _id: 1, name: 1, species: 1, markings: 1, morph: 1 }).lean();

    let changed = 0;
    for (const doc of docs) {
      const merged = mergeValue(doc.markings, doc.morph);
      const markingsChanged = merged !== (doc.markings || '');
      const morphChanged = !!doc.morph;
      if (!markingsChanged && !morphChanged) continue;

      changed++;
      console.log({ id: String(doc._id), name: doc.name, species: doc.species, before: { markings: doc.markings, morph: doc.morph }, after: { markings: merged, morph: null } });

      if (APPLY) {
        await Model.collection.updateOne({ _id: doc._id }, { $set: { markings: merged, morph: null } });
      }
    }
    console.log(`${Model.modelName}: ${changed}/${docs.length} docs changed.`);
  }

  await mongoose.disconnect();
})();
