/**
 * Backfill PublicAnimal.originalCreatorId_public for animals transferred before
 * 2026-09-27 (when resyncAnimalToPublic()/syncAnimalToPublic() started resolving it).
 *
 * Why a join is required: PublicAnimalSchema stores ONLY originalCreatorId_public - it has no
 * originalCreatorId ObjectId. So the original breeder cannot be read off the public mirror; it has
 * to be read off the source Animal (which does have the ObjectId) and then resolved to a User's
 * id_public.
 *
 * Usage:
 *   node scripts/backfillOriginalCreatorIdPublic.js            # dry run, changes nothing
 *   node scripts/backfillOriginalCreatorIdPublic.js --apply    # actually writes
 *
 * Safe to re-run: it only writes rows that are currently null, and it clears nothing.
 */

require('dotenv').config();
const mongoose = require('mongoose');

const APPLY = process.argv.includes('--apply');
const BATCH_SIZE = 200;

async function main() {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
        console.error('MONGODB_URI is not set. Check your .env.');
        process.exit(1);
    }

    await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 });
    console.log('Connected to MongoDB.');

    const { Animal, PublicAnimal, User } = require('../database/models');

    // Only rows that are missing the field - this is what makes a re-run a no-op.
    const candidates = await PublicAnimal.find({
        $or: [
            { originalCreatorId_public: null },
            { originalCreatorId_public: { $exists: false } },
        ],
    })
        .select('id_public')
        .lean();

    console.log(`PublicAnimal rows missing originalCreatorId_public: ${candidates.length}`);
    if (candidates.length === 0) {
        console.log('Nothing to do.');
        await mongoose.disconnect();
        return;
    }

    const idPublics = candidates.map((a) => a.id_public);

    // Pull the source Animals that actually have an original creator. Doing it in one query keeps
    // this to a handful of round trips rather than one lookup per public row.
    const animals = await Animal.find({
        id_public: { $in: idPublics },
        originalCreatorId: { $ne: null },
    })
        .select('id_public originalCreatorId')
        .lean();

    console.log(`Of those, ${animals.length} correspond to a transferred Animal (originalCreatorId set).`);

    if (animals.length === 0) {
        console.log('No transferred animals among them - nothing to backfill.');
        await mongoose.disconnect();
        return;
    }

    // Resolve every original creator ObjectId to a User id_public in one query.
    const creatorObjectIds = [...new Set(animals.map((a) => String(a.originalCreatorId)))];
    const creators = await User.find({ _id: { $in: creatorObjectIds } })
        .select('id_public')
        .lean();
    const publicIdByObjectId = new Map(creators.map((u) => [String(u._id), u.id_public]));

    console.log(`Resolved ${publicIdByObjectId.size} distinct original breeder(s) to a public id.\n`);

    const updates = [];
    const skipped = [];
    for (const animal of animals) {
        const publicId = publicIdByObjectId.get(String(animal.originalCreatorId));
        if (publicId) {
            updates.push({
                updateOne: {
                    filter: { id_public: animal.id_public },
                    update: { $set: { originalCreatorId_public: publicId } },
                },
            });
        } else {
            // The original breeder's User record is gone; nothing sensible to write.
            skipped.push(animal.id_public);
        }
    }

    console.log(`Would backfill ${updates.length} row(s).`);
    if (skipped.length > 0) {
        console.log(`Skipping ${skipped.length} with no matching User record: ${skipped.join(', ')}`);
    }

    // Show a sample so the values can be eyeballed before writing.
    const sample = updates.slice(0, 10).map((u) => {
        const animal = animals.find((a) => a.id_public === u.updateOne.filter.id_public);
        return `  ${u.updateOne.filter.id_public} -> ${u.updateOne.update.$set.originalCreatorId_public}`;
    });
    if (sample.length > 0) {
        console.log('\nSample:');
        console.log(sample.join('\n'));
    }

    if (!APPLY) {
        console.log('\nDry run - nothing was written. Re-run with --apply to write these changes.');
        await mongoose.disconnect();
        return;
    }

    let written = 0;
    for (let i = 0; i < updates.length; i += BATCH_SIZE) {
        const batch = updates.slice(i, i + BATCH_SIZE);
        const result = await PublicAnimal.bulkWrite(batch, { ordered: false });
        written += result.modifiedCount || 0;
    }

    console.log(`\nDone. Wrote ${written} row(s).`);
    await mongoose.disconnect();
}

main().catch(async (err) => {
    console.error('Backfill failed:', err);
    try {
        await mongoose.disconnect();
    } catch (_) {
        // already disconnected
    }
    process.exit(1);
});
