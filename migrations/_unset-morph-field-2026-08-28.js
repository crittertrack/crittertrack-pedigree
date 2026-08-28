// One-time cleanup: $unset the retired `morph` key from every Animal/PublicAnimal doc.
// All values were already null (data migrated to color/markings in prior scripts) — this
// just removes the now-schema-less leftover key from storage. Dry-run by default; --apply to write.
require('dotenv').config();
const mongoose = require('mongoose');
const { Animal, PublicAnimal } = require('../database/models');

const APPLY = process.argv.includes('--apply');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);

  for (const Model of [Animal, PublicAnimal]) {
    const count = await Model.collection.countDocuments({ morph: { $exists: true } });
    console.log(`${Model.modelName}: ${count} docs still have a morph key${APPLY ? ' - unsetting...' : ' (dry run, no writes)'}`);
    if (APPLY && count > 0) {
      const res = await Model.collection.updateMany({ morph: { $exists: true } }, { $unset: { morph: '' } });
      console.log(`${Model.modelName}: unset morph on ${res.modifiedCount} docs.`);
    }
  }

  await mongoose.disconnect();
})();
