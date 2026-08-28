// Merges the legacy `morph` field into `color` for snake species, since the UI now treats
// Color as the single "Morph" field for snakes (separate Morph field is hidden/deprecated
// for these species). Dry-run by default; pass --apply to write changes.
//
// Merge rule per doc: if morph is empty -> leave color untouched. If color is empty -> color
// = morph. If both have (different) values -> concatenate as "color, morph" (per user decision,
// see Snape case: color="Classic", morph="Hetr, Albino, Pied" -> "Classic, Hetr, Albino, Pied").
// After merging, morph is cleared to null for these species (data now lives solely in color).
require('dotenv').config();
const mongoose = require('mongoose');
const { Animal, PublicAnimal } = require('../database/models');

const SNAKE_SPECIES = ['Ball Python', 'Corn Snake', 'Eastern Kingsnake', 'Cape African House Snake'];
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
    const docs = await Model.find({ species: { $in: SNAKE_SPECIES } }, { _id: 1, name: 1, species: 1, color: 1, morph: 1 }).lean();

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
