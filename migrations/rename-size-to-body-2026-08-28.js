// Copies the legacy 'size' field over to the new 'body' field (Animal + PublicAnimal), then
// unsets 'size'. Needed because the schema field was renamed size -> body.
// Dry run by default; pass --apply to write changes.
require('dotenv').config();
const mongoose = require('mongoose');
const { Animal, PublicAnimal } = require('../database/models');

const APPLY = process.argv.includes('--apply');

async function migrateCollection(Model, label) {
  const docs = await Model.find({ size: { $exists: true, $ne: null } }).select('id_public name size body').lean();
  console.log(`${label}: ${docs.length} document(s) with a non-null 'size' to migrate.`);
  docs.slice(0, 10).forEach(d => {
    console.log(`  ${d.id_public || d._id} "${d.name || ''}" size="${d.size}" -> body`);
  });
  if (docs.length > 10) console.log(`  ...and ${docs.length - 10} more`);

  if (APPLY && docs.length > 0) {
    const bulkOps = docs.map(d => ({
      updateOne: {
        filter: { _id: d._id },
        update: { $set: { body: d.size }, $unset: { size: '' } },
      },
    }));
    const result = await Model.bulkWrite(bulkOps);
    console.log(`${label}: modified count:`, result.modifiedCount);
  }

  // Also clean up any docs where size is present but null/blank (just unset it, nothing to copy).
  const emptyFilter = { size: { $exists: true } };
  const emptyCount = await Model.countDocuments(emptyFilter) - docs.length;
  if (emptyCount > 0) {
    console.log(`${label}: ${emptyCount} additional document(s) have a null/empty 'size' field to unset.`);
    if (APPLY) {
      const result = await Model.updateMany(emptyFilter, { $unset: { size: '' } });
      console.log(`${label}: unset-only modified count:`, result.modifiedCount);
    }
  }
}

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);

  await migrateCollection(Animal, 'Animal');
  await migrateCollection(PublicAnimal, 'PublicAnimal');

  if (!APPLY) {
    console.log('\nDry run only — pass --apply to write changes.');
  }

  await mongoose.disconnect();
})();
