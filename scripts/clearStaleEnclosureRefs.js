/**
 * Clear animal.enclosureId where it references an enclosure that no longer exists
 * in the `enclosures` collection (stale on both animals and publicanimals), then
 * re-sync the public mirror for the touched animals.
 *
 * Safety check: an id is only cleared if Enclosure.findById() finds nothing AND
 * the id isn't merely malformed (a non-ObjectId string is reported, not cleared).
 *
 * Usage:
 *   node scripts/clearStaleEnclosureRefs.js            # dry run, changes nothing
 *   node scripts/clearStaleEnclosureRefs.js --apply    # actually writes
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { isValidObjectId } = mongoose;

const APPLY = process.argv.includes('--apply');

const { Animal, PublicAnimal, Enclosure } = require('../database/models');
const { resyncAnimalToPublicById } = require('../utils/syncPublicAnimals');

async function main() {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
        console.error('MONGODB_URI is not set. Check your .env.');
        process.exit(1);
    }

    await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 });
    console.log('Connected to MongoDB.');

    // Every enclosure id actually referenced by either collection.
    const animals = await Animal.find({ enclosureId: { $ne: null } }).select('id_public enclosureId isDisplay').lean();
    const publicRows = await PublicAnimal.find({ enclosureId: { $ne: null } }).select('id_public enclosureId').lean();

    const referenced = new Set();
    for (const a of animals) referenced.add(String(a.enclosureId));
    for (const p of publicRows) referenced.add(String(p.enclosureId));

    const ids = [...referenced];
    const existing = await Enclosure.find({ _id: { $in: ids.filter(isValidObjectId) } }).select('_id').lean();
    const existingSet = new Set(existing.map((e) => String(e._id)));

    const missing = ids.filter((id) => !existingSet.has(id));
    const malformed = missing.filter((id) => !isValidObjectId(id));
    const stale = missing.filter((id) => isValidObjectId(id));

    console.log(`Distinct enclosureIds referenced: ${ids.length}`);
    console.log(`Existing: ${existingSet.size} | Missing: ${missing.length} (${malformed.length} malformed)`);
    if (malformed.length > 0) console.log(`  Malformed (left alone): ${malformed.join(', ')}`);
    if (stale.length > 0) console.log(`  Stale: ${stale.join(', ')}`);

    const staleSet = new Set(stale);
    const animalsToClear = animals.filter((a) => a.enclosureId && staleSet.has(String(a.enclosureId)));
    const publicToClear = publicRows.filter((p) => p.enclosureId && staleSet.has(String(p.enclosureId)));

    console.log(`\nAnimals with a stale enclosureId: ${animalsToClear.length}`);
    for (const a of animalsToClear) console.log(`  ${a.id_public} (${a.isDisplay ? 'public' : 'private'}) -> ${a.enclosureId}`);
    console.log(`Public rows with a stale enclosureId: ${publicToClear.length}`);
    for (const p of publicToClear) console.log(`  ${p.id_public} -> ${p.enclosureId}`);

    if (animalsToClear.length === 0 && publicToClear.length === 0) {
        console.log('\nNo stale references to clear.');
        await mongoose.disconnect();
        return;
    }

    if (!APPLY) {
        console.log('\nDry run - nothing was written. Re-run with --apply to write these changes.');
        await mongoose.disconnect();
        return;
    }

    // Clear on the source of truth first...
    const res = await Animal.updateMany(
        { id_public: { $in: animalsToClear.map((a) => a.id_public) } },
        { $set: { enclosureId: null } }
    );
    console.log(`\nCleared enclosureId on ${res.modifiedCount} animal(s).`);

    // ...then re-sync each touched public mirror through the canonical code path.
    for (const a of animalsToClear) {
        await resyncAnimalToPublicById(a.id_public);
    }
    // Public rows whose animal doesn't exist can't be resynced from source - clear directly.
    const orphanIds = publicToClear.map((p) => p.id_public).filter((id) => !animalsToClear.some((a) => a.id_public === id));
    if (orphanIds.length > 0) {
        await PublicAnimal.updateMany({ id_public: { $in: orphanIds } }, { $set: { enclosureId: null } });
        console.log(`Cleared enclosureId directly on ${orphanIds.length} orphaned public row(s).`);
    }

    // Verify: no stale refs remain anywhere.
    const remaining = await Enclosure.countDocuments({ _id: { $in: stale.filter(isValidObjectId) } });
    const stillStaleAnimals = await Animal.countDocuments({ enclosureId: { $in: stale } });
    const stillStalePublic = await PublicAnimal.countDocuments({ enclosureId: { $in: stale } });
    console.log(`\nVerify: stale ids now in enclosures=${remaining}, animals=${stillStaleAnimals}, publicanimals=${stillStalePublic}`);
    if (stillStaleAnimals > 0 || stillStalePublic > 0) {
        console.error('FAILED verification - stale references remain.');
        await mongoose.disconnect();
        process.exit(1);
    }

    console.log('Done.');
    await mongoose.disconnect();
}

main().catch(async (err) => {
    console.error('Failed:', err);
    try {
        await mongoose.disconnect();
    } catch (_) {
        // already disconnected
    }
    process.exit(1);
});
