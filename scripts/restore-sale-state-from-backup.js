/**
 * Restore sale/reservation fields wiped by clear-sale-state-for-deceased.js from a
 * backup JSON, then turn off isForSale on Deceased/Culled/Rehomed animals.
 *
 * Only animals that currently match the "deceased/culled/rehomed" filter are
 * touched (those are the ones that were cleared), so later edits to other animals
 * are not overwritten. Only the cleared fields are restored, and only when the
 * backup actually has a value for that field.
 *
 * Usage (dry run by default):
 *   node scripts/restore-sale-state-from-backup.js <backup.json>
 *   node scripts/restore-sale-state-from-backup.js <backup.json> --apply
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const { connectDB } = require('../database/db_service');
const { Animal, PublicAnimal } = require('../database/models');

const DEATH_OR_REHOMED = {
    $or: [
        { deceasedDate: { $ne: null } },
        { status: { $in: ['Deceased', 'Culled', 'Rehomed'] } },
    ],
};

const ANIMAL_FIELDS = [
    'soldStatus', 'saleDate', 'salePrice', 'saleRecordCurrency', 'buyerName',
    'buyerContact', 'saleTransactionId', 'isForSale', 'salePriceAmount',
    'salePriceCurrency', 'studFeeAmount', 'studFeeCurrency',
];
const PUBLIC_FIELDS = [
    'isForSale', 'salePriceAmount', 'salePriceCurrency', 'studFeeAmount', 'studFeeCurrency',
];

function pickFields(src, fields) {
    const out = {};
    for (const f of fields) {
        if (src[f] !== undefined) out[f] = src[f];
    }
    return out;
}

async function restore(Model, label, backupDocs, fields, apply, snapshot) {
    const current = await Model.find(DEATH_OR_REHOMED).select(['_id', ...fields].join(' ')).lean();
    const byId = new Map(backupDocs.map((d) => [String(d._id), d]));
    snapshot[label] = current;

    const ops = [];
    let missingInBackup = 0;
    for (const cur of current) {
        const bak = byId.get(String(cur._id));
        if (!bak) { missingInBackup++; continue; }
        const set = pickFields(bak, fields);
        if (Object.keys(set).length) {
            ops.push({ updateOne: { filter: { _id: cur._id }, update: { $set: set } } });
        }
    }
    console.log(`[${label}] matching now=${current.length}, restorable=${ops.length}, not in backup=${missingInBackup}`);
    if (apply && ops.length) {
        const r = await Model.bulkWrite(ops, { ordered: false });
        console.log(`[${label}] restored modified=${r.modifiedCount}`);
    }

    // Step 2: turn off For Sale checkmark on deceased/culled/rehomed.
    const filter = { $and: [DEATH_OR_REHOMED, { isForSale: true }] };
    if (apply) {
        const r = await Model.updateMany(filter, { $set: { isForSale: false } });
        console.log(`[${label}] isForSale turned off: ${r.modifiedCount}`);
    } else {
        const n = await Model.countDocuments({ $and: [DEATH_OR_REHOMED, { isForSale: true }] });
        console.log(`[${label}] (dry run) isForSale currently true on matching: ${n}`);
    }
}

async function run() {
    const file = process.argv[2];
    const apply = process.argv.includes('--apply');
    if (!file) throw new Error('Usage: node scripts/restore-sale-state-from-backup.js <backup.json> [--apply]');
    if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is not defined.');

    const backup = JSON.parse(fs.readFileSync(file, 'utf8'));
    await connectDB(process.env.MONGODB_URI);
    console.log(`[Restore] Connected. Mode: ${apply ? 'APPLY' : 'DRY RUN'}`);

    const snapshot = {};
    await restore(Animal, 'animals', backup.animals || [], ANIMAL_FIELDS, apply, snapshot);
    await restore(PublicAnimal, 'publicAnimals', backup.publicAnimals || [], PUBLIC_FIELDS, apply, snapshot);

    if (apply) {
        const out = path.join(path.dirname(path.resolve(file)), `pre-restore-snapshot-${Date.now()}.json`);
        fs.writeFileSync(out, JSON.stringify(snapshot));
        console.log(`[Restore] Pre-restore snapshot written: ${out}`);
    }
    await mongoose.disconnect();
    console.log('[Restore] Done.');
}

run().catch((err) => {
    console.error('[Restore] error:', err);
    process.exit(1);
});
