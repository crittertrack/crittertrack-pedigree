// FIX-UP SCRIPT (one-time, follow-up to merge-markings-into-coatpattern-then-rename-2026-08-17.js)
//
// Root cause found: at the time the original migration ran with --apply, database/models.js
// had ALREADY been edited to remove the `coatPattern` schema path (replaced with `markings`).
// Because Mongoose's default `strict` mode strips update-operator entries that reference
// unknown schema paths, BOTH the merge step (`$set: { coatPattern: merged }`) and the rename
// step (`$rename: { coatPattern: 'markings' }`) were silently dropped by Mongoose — even though
// Mongoose reported non-zero `modifiedCount` (because `{ timestamps: true }` bumped `updatedAt`
// on every matched doc, masking the fact that the actual field write never happened).
// Only the `$unset: { markings: '' }` step actually worked, because `markings` IS a valid
// schema path. Net effect: `coatPattern` still holds the ORIGINAL (pre-merge) values, and
// `markings` was wiped everywhere.
//
// This script uses the RAW native MongoDB driver (bypassing Mongoose model/schema casting
// entirely) to safely: (1) rename coatPattern -> markings on any remaining raw documents,
// then (2) overwrite `markings` with the correct pre-computed merged values for the 9 Animal
// docs / 4 PublicAnimal docs that originally had both fields filled (values taken verbatim
// from the original migration's dry-run/apply console output).
//
// Dry-run by default. Pass --apply to actually write.
require('dotenv').config();
const mongoose = require('mongoose');

const APPLY = process.argv.includes('--apply');

// Exact merged values captured from the original migration's logged output.
const ANIMAL_MERGED = {
    CTC2532: 'mottled / silvered',
    CTC2537: 'Mottled / Extensive "frosting"',
    CTC7001: 'Dom Mottled / heavily silvered',
    CTC7034: 'Capped / Cap/Mismarked on lower back',
    CTC7035: 'Berkshire / White belly and paws',
    CTC7036: 'Roan',
    CTC7037: 'Siamese / Dark nose and bum',
    CTC7181: 'Berkshire / Fléché',
    CTC7209: 'Blazed / Variberk',
};
const PUBLIC_ANIMAL_MERGED = {
    CTC2532: 'mottled / silvered',
    CTC2537: 'Mottled / Extensive "frosting"',
    CTC7001: 'Dom Mottled / heavily silvered',
    CTC7181: 'Berkshire / Fléché',
};

(async () => {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log(APPLY ? 'APPLY MODE — writing changes' : 'DRY RUN — no changes written (re-run with --apply to write)');
    const db = mongoose.connection.db;
    const animals = db.collection('animals');
    const publicAnimals = db.collection('publicanimals');

    for (const [collName, coll] of [['animals', animals], ['publicanimals', publicAnimals]]) {
        const remaining = await coll.countDocuments({ coatPattern: { $exists: true } });
        console.log(`[${collName}] docs still holding raw 'coatPattern' field: ${remaining}`);
        if (APPLY && remaining > 0) {
            const res = await coll.updateMany({ coatPattern: { $exists: true } }, { $rename: { coatPattern: 'markings' } });
            console.log(`[${collName}] renamed coatPattern -> markings: matched=${res.matchedCount} modified=${res.modifiedCount}`);
        }
    }

    for (const [collName, coll, map] of [['animals', animals, ANIMAL_MERGED], ['publicanimals', publicAnimals, PUBLIC_ANIMAL_MERGED]]) {
        for (const [id_public, merged] of Object.entries(map)) {
            const doc = await coll.findOne({ id_public });
            if (!doc) { console.log(`[${collName}] ${id_public}: NOT FOUND, skipping`); continue; }
            console.log(`[${collName}] ${id_public}: current markings="${doc.markings || ''}" -> "${merged}"`);
            if (APPLY) {
                await coll.updateOne({ _id: doc._id }, { $set: { markings: merged } });
            }
        }
    }

    if (APPLY) {
        const leftoverAnimal = await animals.countDocuments({ coatPattern: { $exists: true } });
        const leftoverPublic = await publicAnimals.countDocuments({ coatPattern: { $exists: true } });
        console.log(`\nVerification — remaining raw coatPattern fields: animals=${leftoverAnimal}, publicanimals=${leftoverPublic}`);
    } else {
        console.log('\n(Dry run complete — re-run with --apply to write.)');
    }

    await mongoose.disconnect();
})();
