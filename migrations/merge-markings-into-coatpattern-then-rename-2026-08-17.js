// One-time migration:
//   1. Merge any `markings` value into `coatPattern` (append if not already present).
//   2. Unset the now-redundant `markings` field everywhere.
//   3. Rename `coatPattern` -> `markings` (the surviving field keeps the "markings" name).
//   4. Carry over per-user `AppearanceFieldOption` dropdown entries (field: 'coatPattern' -> 'markings'),
//      deduping against any options already saved under 'markings'.
//
// Dry-run by default (prints what would change). Pass --apply to actually write.
require('dotenv').config();
const mongoose = require('mongoose');
const { Animal, PublicAnimal, AppearanceFieldOption } = require('../database/models');

const APPLY = process.argv.includes('--apply');

function mergedValue(coatPattern, markings) {
    const cp = (coatPattern || '').trim();
    const mk = (markings || '').trim();
    if (!mk) return cp || null;
    if (!cp) return mk;
    if (cp.toLowerCase().includes(mk.toLowerCase())) return cp; // already redundant, keep as-is
    return `${cp} / ${mk}`;
}

async function mergeCollection(Model, label) {
    const docs = await Model.find({ markings: { $exists: true, $ne: null, $nin: [''] } })
        .select('id_public coatPattern markings').lean();
    console.log(`\n[${label}] ${docs.length} doc(s) with markings filled:`);
    for (const doc of docs) {
        const merged = mergedValue(doc.coatPattern, doc.markings);
        console.log(`  ${doc.id_public}: coatPattern="${doc.coatPattern || ''}" + markings="${doc.markings}" -> "${merged}"`);
        if (APPLY) {
            await Model.updateOne({ _id: doc._id }, { $set: { coatPattern: merged } });
        }
    }
    return docs.length;
}

(async () => {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log(APPLY ? 'APPLY MODE \u2014 writing changes' : 'DRY RUN \u2014 no changes written (re-run with --apply to write)');

    await mergeCollection(Animal, 'Animal');
    await mergeCollection(PublicAnimal, 'PublicAnimal');

    if (APPLY) {
        const unsetAnimal = await Animal.updateMany({}, { $unset: { markings: '' } });
        const unsetPublic = await PublicAnimal.updateMany({}, { $unset: { markings: '' } });
        console.log(`\nUnset markings \u2014 Animal: ${unsetAnimal.modifiedCount}, PublicAnimal: ${unsetPublic.modifiedCount}`);

        const renameAnimal = await Animal.updateMany({ coatPattern: { $exists: true } }, { $rename: { coatPattern: 'markings' } });
        const renamePublic = await PublicAnimal.updateMany({ coatPattern: { $exists: true } }, { $rename: { coatPattern: 'markings' } });
        console.log(`Renamed coatPattern->markings \u2014 Animal: ${renameAnimal.modifiedCount}, PublicAnimal: ${renamePublic.modifiedCount}`);

        const existingMarkingsOptions = await AppearanceFieldOption.find({ field: 'markings' }).lean();
        const markingsKeySet = new Set(existingMarkingsOptions.map(o => `${o.userId}|${o.species}|${o.value.toLowerCase()}`));
        const coatPatternOptions = await AppearanceFieldOption.find({ field: 'coatPattern' }).lean();
        let optionsRenamed = 0, optionsDeleted = 0;
        for (const opt of coatPatternOptions) {
            const key = `${opt.userId}|${opt.species}|${opt.value.toLowerCase()}`;
            if (markingsKeySet.has(key)) {
                await AppearanceFieldOption.deleteOne({ _id: opt._id });
                optionsDeleted++;
            } else {
                await AppearanceFieldOption.updateOne({ _id: opt._id }, { $set: { field: 'markings' } });
                optionsRenamed++;
            }
        }
        console.log(`AppearanceFieldOption \u2014 renamed: ${optionsRenamed}, deduped/deleted: ${optionsDeleted}`);
    } else {
        console.log('\n(Dry run complete \u2014 re-run with --apply to unset markings, rename coatPattern->markings, and migrate AppearanceFieldOption.)');
    }

    await mongoose.disconnect();
})();
