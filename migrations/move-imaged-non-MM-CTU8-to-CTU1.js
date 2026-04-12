/**
 * One-time migration: Move all CTU8 animals that have a profile image
 * and do NOT have prefix 'MM' to CTU1.
 *
 * Updates:
 *   - Animal: ownerId, ownerId_public, isOwned
 *   - PublicAnimal: ownerId_public, isOwned
 *   - Rebuilds User.ownedAnimals for CTU8 and CTU1
 *
 * Usage:
 *   DRY RUN (default):  node migrations/move-imaged-non-MM-CTU8-to-CTU1.js
 *   EXECUTE:            $env:CONFIRM='yes'; node migrations/move-imaged-non-MM-CTU8-to-CTU1.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const { Animal, PublicAnimal, User } = require('../database/models');

async function run() {
    const uri = process.env.MONGODB_URI;
    if (!uri) { console.error('MONGODB_URI not set'); process.exit(1); }

    const dryRun = process.env.CONFIRM !== 'yes';

    await mongoose.connect(uri);
    console.log('Connected to MongoDB');
    console.log(dryRun ? '*** DRY RUN — no changes will be made ***\n' : '*** LIVE RUN ***\n');

    // ── Look up both users ──
    const userCTU8 = await User.findOne({ id_public: 'CTU8' }).select('_id id_public');
    const userCTU1 = await User.findOne({ id_public: 'CTU1' }).select('_id id_public');

    if (!userCTU8) { console.error('CTU8 user not found'); process.exit(1); }
    if (!userCTU1) { console.error('CTU1 user not found'); process.exit(1); }

    console.log(`CTU8 _id: ${userCTU8._id}`);
    console.log(`CTU1 _id: ${userCTU1._id}\n`);

    // ── Find matching animals: has imageUrl, prefix != MM, owned by CTU8 ──
    const animals = await Animal.find({
        ownerId_public: 'CTU8',
        imageUrl: { $ne: null, $exists: true, $nin: ['', null] },
        prefix: { $ne: 'MM' }
    }).select('_id id_public name prefix imageUrl').sort({ prefix: 1, name: 1 });

    console.log(`Found ${animals.length} animals (have image, prefix ≠ MM) on CTU8\n`);

    if (animals.length === 0) {
        console.log('Nothing to move.');
        await mongoose.disconnect();
        return;
    }

    // Show by prefix
    const byPrefix = {};
    for (const a of animals) {
        byPrefix[a.prefix] = (byPrefix[a.prefix] || 0) + 1;
    }
    for (const [p, c] of Object.entries(byPrefix).sort((a, b) => a[0].localeCompare(b[0]))) {
        console.log(`  ${p}: ${c}`);
    }
    console.log();

    // List all
    for (const a of animals) {
        console.log(`  ${a.id_public}  ${a.prefix} ${a.name}`);
    }
    console.log();

    if (dryRun) {
        console.log('Set CONFIRM=yes to execute.');
        await mongoose.disconnect();
        return;
    }

    // ── Execute the move ──
    const animalIds = animals.map(a => a._id);
    const animalIdPublics = animals.map(a => a.id_public);

    // 1. Update Animal docs
    const animalResult = await Animal.updateMany(
        { _id: { $in: animalIds } },
        { $set: { ownerId: userCTU1._id, ownerId_public: 'CTU1', isOwned: true } }
    );
    console.log(`Animal: matched ${animalResult.matchedCount}, modified ${animalResult.modifiedCount}`);

    // 2. Update PublicAnimal docs
    const publicResult = await PublicAnimal.updateMany(
        { id_public: { $in: animalIdPublics } },
        { $set: { ownerId_public: 'CTU1', isOwned: true } }
    );
    console.log(`PublicAnimal: matched ${publicResult.matchedCount}, modified ${publicResult.modifiedCount}`);

    // 3. Rebuild User.ownedAnimals for both users
    const ctu8Animals = await Animal.find({ ownerId_public: 'CTU8' }).select('_id').lean();
    const ctu1Animals = await Animal.find({ ownerId_public: 'CTU1' }).select('_id').lean();

    await User.updateOne({ _id: userCTU8._id }, { $set: { ownedAnimals: ctu8Animals.map(a => a._id) } });
    console.log(`CTU8 ownedAnimals rebuilt: ${ctu8Animals.length}`);

    await User.updateOne({ _id: userCTU1._id }, { $set: { ownedAnimals: ctu1Animals.map(a => a._id) } });
    console.log(`CTU1 ownedAnimals rebuilt: ${ctu1Animals.length}`);

    // ── Verify ──
    const remaining = await Animal.countDocuments({ ownerId_public: 'CTU8', imageUrl: { $ne: null, $exists: true, $nin: ['', null] }, prefix: { $ne: 'MM' } });
    const moved = await Animal.countDocuments({ ownerId_public: 'CTU1' });
    console.log(`\nVerification: matching animals still on CTU8 = ${remaining}, total on CTU1 = ${moved}`);

    console.log('\nDone!');
    await mongoose.disconnect();
}

run().catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
});
