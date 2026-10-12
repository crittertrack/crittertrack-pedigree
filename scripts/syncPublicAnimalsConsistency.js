/**
 * Re-sync existing `publicanimals` rows against the source `animals` collection.
 *
 * For each row already in publicanimals, every mirrored field (enclosureId,
 * housingType, bedding, enrichment, temperature/humidity/lighting, plus all other
 * shared fields) is compared with the current Animal and corrected where it
 * drifted. Duplicate rows sharing one id_public are consolidated down to a single
 * copy (the freshest one). No rows are created - only existing rows are touched.
 *
 * Usage:
 *   node scripts/syncPublicAnimalsConsistency.js            # dry run, changes nothing
 *   node scripts/syncPublicAnimalsConsistency.js --apply    # actually writes
 *
 * Safe to re-run: a second run reports 0 differences.
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { isDeepStrictEqual } = require('util');

const APPLY = process.argv.includes('--apply');
const BATCH_SIZE = 200;

const { Animal, PublicAnimal, User, Enclosure } = require('../database/models');
const { buildPublicAnimalFields } = require('../utils/syncPublicAnimals');

// Fields that are bookkeeping, not mirrored animal data.
const SKIP_FIELDS = new Set(['_id', '__v', 'createdAt', 'updatedAt', 'id_public', 'creatorId_public']);

// Normalize values (Date/ObjectId/undefined) so comparisons are stable.
// `seen` guards against circular references (mongoose subdocuments from .cast() point
// back at their parent array/document), and documents are flattened via toObject() so
// an EmbeddedDocument compares equal to the plain object a .lean() read returns.
const normalize = (value, seen = new Set()) => {
    if (value === undefined) return null;
    if (value instanceof Date) return value.toISOString();
    if (value && value._bsontype === 'ObjectId') return String(value);
    if (value && typeof value.toObject === 'function') {
        if (seen.has(value)) return '[circular]';
        seen.add(value);
        return normalize(value.toObject(), seen);
    }
    if (Array.isArray(value)) {
        if (seen.has(value)) return '[circular]';
        seen.add(value);
        return value.map((v) => normalize(v, seen));
    }
    if (value && typeof value === 'object') {
        if (seen.has(value)) return '[circular]';
        seen.add(value);
        return Object.fromEntries(Object.keys(value).sort().map((k) => [k, normalize(value[k], seen)]));
    }
    return value;
};

async function main() {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
        console.error('MONGODB_URI is not set. Check your .env.');
        process.exit(1);
    }

    await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 });
    console.log('Connected to MongoDB.');

    const publicRowsAll = await PublicAnimal.find({}).lean();

    // --- Consolidate duplicates: only one public row per id_public may exist ---
    // Keep the freshest copy (newest updatedAt); the rest are stale twins that would
    // otherwise keep failing the consistency check forever.
    const grouped = new Map();
    for (const row of publicRowsAll) {
        const list = grouped.get(row.id_public) || [];
        list.push(row);
        grouped.set(row.id_public, list);
    }
    const duplicateIds = [];
    const staleDuplicateMongoIds = [];
    for (const [id_public, list] of grouped) {
        if (list.length < 2) continue;
        duplicateIds.push(id_public);
        list.sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
        staleDuplicateMongoIds.push(...list.slice(1).map((r) => r._id));
    }

    const animals = await Animal.find({ id_public: { $in: [...grouped.keys()] } }).lean();
    const animalById = new Map(animals.map((a) => [a.id_public, a]));

    // Only the kept (freshest) copy of each id_public is compared/updated.
    const publicRows = [...grouped.values()].map((list) => list[0]);

    // Every field the public schema can store, so identity holds for fields the
    // explicit mapping doesn't cover too (ownerId_public, colonyId, sbId, ...).
    const publicPaths = Object.keys(PublicAnimal.schema.paths).filter((k) => !SKIP_FIELDS.has(k));

    const updates = [];
    const skipped = [];
    const fieldMismatches = new Map();
    const castFailures = []; // values that can't be written to the public schema at all
    const noteMismatch = (field) => fieldMismatches.set(field, (fieldMismatches.get(field) || 0) + 1);
    const enclosureChanges = []; // rows whose enclosureId would change: { id, from, to }
    const referencedEnclosures = new Set(); // enclosureIds currently used by public rows or their animals

    for (const row of publicRows) {
        const animal = animalById.get(row.id_public);
        if (!animal) {
            skipped.push(row.id_public);
            continue;
        }

        // Expected public state: raw schema-shared values, then the canonical
        // mapping (which applies the same defaults a normal edit would). Both are
        // filtered to real PublicAnimal schema fields so the script only ever
        // writes something the schema will actually keep.
        const mapped = buildPublicAnimalFields(animal);
        if (animal.originalCreatorId && !mapped.originalCreatorId_public) {
            const creator = await User.findById(animal.originalCreatorId).select('id_public').lean();
            mapped.originalCreatorId_public = creator?.id_public || null;
        }

        const expected = {};
        for (const field of publicPaths) {
            const value = field in mapped ? mapped[field] : animal[field];
            if (value !== undefined) expected[field] = value;
        }

        const $set = {};
        const changes = [];
        for (const [field, value] of Object.entries(expected)) {
            if (field === 'id_public' || field === 'creatorId_public') continue;

            // Cast through the public schema first: the raw Animal value and the stored
            // mirror value must be compared in the form mongoose would actually write
            // (e.g. "5" -> 5, "" -> null), otherwise rows flag forever with no real drift.
            let castValue;
            try {
                castValue = PublicAnimal.schema.paths[field].cast(value);
            } catch (err) {
                castFailures.push(`${field}: ${err.message}`);
                continue;
            }

            if (!isDeepStrictEqual(normalize(row[field]), normalize(castValue))) {
                $set[field] = castValue;
                changes.push(`${field}: ${JSON.stringify(row[field])} -> ${JSON.stringify(castValue)}`);
                noteMismatch(field);
            }
        }

        // Track enclosure references so we can verify they still resolve.
        for (const id of [row.enclosureId, animal.enclosureId]) {
            if (id) referencedEnclosures.add(String(id));
        }
        if ('enclosureId' in $set) {
            enclosureChanges.push({
                id: row.id_public,
                from: row.enclosureId || null,
                to: $set.enclosureId || null,
            });
        }

        if (Object.keys($set).length > 0) {
            // Stamp the mirror's own write time only on rows that actually change.
            $set.updatedAt = new Date();
            updates.push({ updateOne: { filter: { id_public: row.id_public }, update: { $set } }, changes });
        }
    }

    console.log(`publicanimals rows: ${publicRowsAll.length} (${publicRows.length} unique id_public) | matched animals: ${animals.length}`);
    if (duplicateIds.length > 0) {
        console.log(`Duplicate id_public found: ${duplicateIds.length} (${duplicateIds.join(', ')}) -> ${staleDuplicateMongoIds.length} stale copy(ies) to delete`);
    }
    if (skipped.length > 0) {
        console.log(`Skipped ${skipped.length} row(s) with no matching animal: ${skipped.join(', ')}`);
    }
    console.log(`Rows out of sync: ${updates.length}`);

    if (castFailures.length > 0) {
        console.log(`\nWARNING: ${castFailures.length} value(s) cannot be written to the public schema:`);
        console.log(`  ${[...new Set(castFailures)].slice(0, 10).join('\n  ')}`);
    }

    if (fieldMismatches.size > 0) {
        console.log('\nField mismatches:');
        for (const [field, count] of [...fieldMismatches].sort((a, b) => b[1] - a[1])) {
            console.log(`  ${field}: ${count}`);
        }
    }

    if (updates.length > 0 && updates.length <= 25) {
        // Small enough to print every change so a dry run can be eyeballed line by line.
        console.log('\nDetailed changes:');
        for (const u of updates) {
            console.log(`  ${u.updateOne.filter.id_public}:`);
            for (const c of u.changes) console.log(`      ${c}`);
        }
    } else if (updates.length > 0) {
        const sample = updates.slice(0, 10).map((u) => `  ${u.updateOne.filter.id_public}: ${Object.keys(u.updateOne.update.$set).join(', ')}`);
        console.log(`\nSample updates:\n${sample.join('\n')}`);
    }

    // --- Enclosure audit: do the referenced enclosures still exist? ---
    const existingEnclosures = new Set(
        (await Enclosure.find({}).select('_id').lean()).map((e) => String(e._id))
    );
    const missingEnclosures = [...referencedEnclosures].filter((id) => !existingEnclosures.has(id));

    console.log('\nEnclosure audit:');
    console.log(`  Distinct enclosureIds referenced by public rows/animals: ${referencedEnclosures.size}`);
    console.log(`  Referenced enclosures that NO LONGER EXIST: ${missingEnclosures.length}`);
    if (missingEnclosures.length > 0) console.log(`    ${missingEnclosures.join(', ')}`);

    const rowsTouchingMissing = publicRows.filter((row) => {
        const animal = animalById.get(row.id_public);
        return (row.enclosureId && missingEnclosures.includes(String(row.enclosureId)))
            || (animal && animal.enclosureId && missingEnclosures.includes(String(animal.enclosureId)));
    });
    console.log(`  Public rows affected by a missing enclosure: ${rowsTouchingMissing.length}`);
    if (rowsTouchingMissing.length > 0) {
        console.log(`    ${rowsTouchingMissing.slice(0, 20).map((r) => r.id_public).join(', ')}${rowsTouchingMissing.length > 20 ? ', ...' : ''}`);
    }

    console.log(`  Rows whose enclosureId would change: ${enclosureChanges.length}`);
    const toExisting = enclosureChanges.filter((c) => c.to && existingEnclosures.has(String(c.to)));
    const toMissing = enclosureChanges.filter((c) => c.to && !existingEnclosures.has(String(c.to)));
    const toNone = enclosureChanges.filter((c) => !c.to);
    console.log(`    -> pointing at an existing enclosure: ${toExisting.length}`);
    console.log(`    -> unassigned (enclosure cleared):    ${toNone.length}`);
    console.log(`    -> pointing at a MISSING enclosure:    ${toMissing.length}`);
    const encSample = enclosureChanges.slice(0, 15)
        .map((c) => `  ${c.id}: ${c.from || '(none)'} -> ${c.to || '(none)'}${c.to && !existingEnclosures.has(String(c.to)) ? '  [MISSING TARGET]' : ''}`);
    if (encSample.length > 0) console.log(`\nSample enclosure changes:\n${encSample.join('\n')}`);

    const pendingDeletions = staleDuplicateMongoIds.length;
    if (updates.length === 0 && pendingDeletions === 0) {
        console.log('\npublicanimals is already in sync with animals.');
        await mongoose.disconnect();
        return;
    }

    if (!APPLY) {
        console.log('\nDry run - nothing was written. Re-run with --apply to write these changes.');
        await mongoose.disconnect();
        return;
    }

    if (pendingDeletions > 0) {
        const res = await PublicAnimal.deleteMany({ _id: { $in: staleDuplicateMongoIds } });
        console.log(`\nConsolidated duplicates: deleted ${res.deletedCount} stale copy(ies).`);
    }

    let written = 0;
    const validationErrors = [];
    for (let i = 0; i < updates.length; i += BATCH_SIZE) {
        const result = await PublicAnimal.bulkWrite(updates.slice(i, i + BATCH_SIZE), { ordered: false });
        written += result.modifiedCount || 0;
        // mongoose silently drops ops whose values fail schema casting (they show up here
        // instead of throwing) — surface them so drift can't quietly survive a run.
        for (const err of result.mongoose?.validationErrors || []) {
            validationErrors.push(`${err.path}: ${err.message}`);
        }
    }
    if (validationErrors.length > 0) {
        console.error(`\nERROR: ${validationErrors.length} field write(s) were rejected by schema casting:`);
        console.error(`  ${validationErrors.slice(0, 10).join('\n  ')}`);
        console.error('These rows are still out of sync - fix the schema/type mismatch and re-run.');
    }

    console.log(`\nDone. Updated ${written} row(s).`);
    await mongoose.disconnect();
}

main().catch(async (err) => {
    console.error('Sync failed:', err);
    try {
        await mongoose.disconnect();
    } catch (_) {
        // already disconnected
    }
    process.exit(1);
});
