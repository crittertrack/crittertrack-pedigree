// Backfills sireId_public/damId_public from manualPedigree.sire/dam.ctcId for animals where
// the pedigree tab's CTC picker was used to assign a parent but the canonical sireId_public/
// damId_public field was never synced due to a bug in updateAnimal() (db_service.js) — the
// sync was gated behind "updates.sireId_public === undefined", which the animal edit form's
// payload (always echoing back the last-known sireId_public/damId_public) almost never
// satisfied. Fixed going forward in db_service.js; this backfills existing affected documents.
// Only touches documents where sireId_public/damId_public is currently null/missing and
// manualPedigree has a real ctcId to fill it with — never overwrites an existing value.
// Dry-run by default (reports what it would change). Pass --apply to actually write.
// Run with: node migrations/backfill-sireid-damid-from-manualpedigree-2026-08-13.js [--apply]
require('dotenv').config();
const mongoose = require('mongoose');

async function main() {
    const apply = process.argv.includes('--apply');
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error('MONGODB_URI not found in environment variables.');
    await mongoose.connect(uri);
    console.log(`Connected to MongoDB. Mode: ${apply ? 'APPLY' : 'DRY RUN'}\n`);
    const col = mongoose.connection.db.collection('animals');

    const cursor = col.find({
        'manualPedigree.sire.ctcId': { $exists: true, $nin: [null, ''] },
    }).project({ id_public: 1, name: 1, sireId_public: 1, damId_public: 1, manualPedigree: 1 });

    const cursorDam = col.find({
        'manualPedigree.dam.ctcId': { $exists: true, $nin: [null, ''] },
    }).project({ id_public: 1, name: 1, sireId_public: 1, damId_public: 1, manualPedigree: 1 });

    const candidates = new Map();
    for await (const doc of cursor) candidates.set(String(doc._id), doc);
    for await (const doc of cursorDam) candidates.set(String(doc._id), doc);

    let sireFixed = 0;
    let damFixed = 0;
    for (const doc of candidates.values()) {
        const set = {};
        const sireCtc = doc.manualPedigree?.sire?.ctcId;
        const damCtc = doc.manualPedigree?.dam?.ctcId;
        if (sireCtc && !doc.sireId_public) {
            set.sireId_public = sireCtc;
            sireFixed++;
        }
        if (damCtc && !doc.damId_public) {
            set.damId_public = damCtc;
            damFixed++;
        }
        if (Object.keys(set).length === 0) continue;
        console.log(`${doc.id_public} (${doc.name || 'unnamed'}): ${JSON.stringify(set)}`);
        if (apply) {
            await col.updateOne({ _id: doc._id }, { $set: set });
        }
    }

    console.log(`\nTotal: ${sireFixed} sireId_public backfilled, ${damFixed} damId_public backfilled.`);
    if (!apply) console.log('Dry run only — re-run with --apply to write these changes.');

    await mongoose.disconnect();
}

main().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
