// Migration: consolidate the legacy `phenotype` free-text field into `color`, then remove
// `phenotype` entirely (Animal + PublicAnimal). Per user: if `color` already has a value,
// append `phenotype`'s value to it rather than overwrite.
//
// Live-data check (2026-08-05) found `phenotype` exists on 5648/6385 `animals` docs but every
// value is null/empty — zero real user-entered data. This script is written defensively to
// handle any real values anyway (appending to color, or setting color if empty), in case any
// stray data exists that a broad `distinct()` scan missed.
//
// Run with no args for a dry run (prints planned changes only). Pass --apply to write changes.

require('dotenv').config();
const mongoose = require('mongoose');

async function migrateCollection(collection, apply) {
    const withPhenotype = await collection.find({ phenotype: { $exists: true, $nin: [null, ''] } }).toArray();
    console.log(`${collection.collectionName}: ${withPhenotype.length} docs with real phenotype data`);

    for (const doc of withPhenotype) {
        const newColor = doc.color && doc.color.trim()
            ? `${doc.color} ${doc.phenotype}`
            : doc.phenotype;
        console.log(`  [${doc.id_public || doc._id}] color: "${doc.color || ''}" + phenotype: "${doc.phenotype}" -> "${newColor}"`);
        if (apply) {
            await collection.updateOne({ _id: doc._id }, { $set: { color: newColor } });
        }
    }

    const totalWithField = await collection.countDocuments({ phenotype: { $exists: true } });
    console.log(`${collection.collectionName}: ${totalWithField} docs have the phenotype field at all (incl. null/empty) — will be unset`);
    if (apply) {
        const res = await collection.updateMany({ phenotype: { $exists: true } }, { $unset: { phenotype: '' } });
        console.log(`${collection.collectionName}: unset phenotype from ${res.modifiedCount} docs`);
    }
}

(async () => {
    const apply = process.argv.includes('--apply');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log(`Mode: ${apply ? 'APPLY' : 'DRY RUN'}\n`);

    await migrateCollection(mongoose.connection.db.collection('animals'), apply);
    console.log('');
    await migrateCollection(mongoose.connection.db.collection('publicanimals'), apply);

    if (!apply) console.log('\nDry run only — re-run with --apply to write changes.');
    await mongoose.disconnect();
})();
