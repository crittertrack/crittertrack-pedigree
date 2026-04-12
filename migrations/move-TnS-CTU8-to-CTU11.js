/**
 * One-time migration: Move all TnS-prefix animals from CTU8 to CTU11.
 *
 * Straight ownership reassignment (not a transfer):
 *   - Animal: ownerId, ownerId_public
 *   - PublicAnimal: ownerId_public (where exists)
 *   - User CTU8: $pull ownedAnimals
 *   - User CTU11: $addToSet ownedAnimals
 *
 * Usage:
 *   DRY RUN (default):  node migrations/move-TnS-CTU8-to-CTU11.js
 *   EXECUTE:            $env:CONFIRM='yes'; node migrations/move-TnS-CTU8-to-CTU11.js
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
    const userCTU8 = await User.findOne({ id_public: 'CTU8' }).select('_id id_public ownedAnimals');
    const userCTU11 = await User.findOne({ id_public: 'CTU11' }).select('_id id_public ownedAnimals');

    if (!userCTU8) { console.error('CTU8 user not found'); process.exit(1); }
    if (!userCTU11) { console.error('CTU11 user not found'); process.exit(1); }

    console.log(`CTU8  _id: ${userCTU8._id}  (ownedAnimals: ${userCTU8.ownedAnimals.length})`);
    console.log(`CTU11 _id: ${userCTU11._id}  (ownedAnimals: ${userCTU11.ownedAnimals.length})\n`);

    // ── Find TnS animals currently owned by CTU8 ──
    const animals = await Animal.find({
        prefix: 'TnS',
        ownerId_public: 'CTU8'
    }).select('_id id_public name prefix');

    console.log(`Found ${animals.length} TnS animals on CTU8\n`);

    if (animals.length === 0) {
        console.log('Nothing to move.');
        await mongoose.disconnect();
        return;
    }

    // Show what will be moved
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

    // 1. Update Animal docs — owner fields only
    const animalResult = await Animal.updateMany(
        { _id: { $in: animalIds } },
        {
            $set: {
                ownerId: userCTU11._id,
                ownerId_public: 'CTU11'
            }
        }
    );
    console.log(`Animal: matched ${animalResult.matchedCount}, modified ${animalResult.modifiedCount}`);

    // 2. Update PublicAnimal docs
    const publicResult = await PublicAnimal.updateMany(
        { id_public: { $in: animalIdPublics } },
        { $set: { ownerId_public: 'CTU11' } }
    );
    console.log(`PublicAnimal: matched ${publicResult.matchedCount}, modified ${publicResult.modifiedCount}`);

    // 3. Rebuild User.ownedAnimals for both users from actual Animal docs
    //    (arrays are out of sync from Kintraks import — fix them properly)
    const ctu8Animals = await Animal.find({ ownerId_public: 'CTU8' }).select('_id').lean();
    const ctu11Animals = await Animal.find({ ownerId_public: 'CTU11' }).select('_id').lean();

    await User.updateOne(
        { _id: userCTU8._id },
        { $set: { ownedAnimals: ctu8Animals.map(a => a._id) } }
    );
    console.log(`CTU8 ownedAnimals rebuilt: ${ctu8Animals.length}`);

    await User.updateOne(
        { _id: userCTU11._id },
        { $set: { ownedAnimals: ctu11Animals.map(a => a._id) } }
    );
    console.log(`CTU11 ownedAnimals rebuilt: ${ctu11Animals.length}`);

    // ── Verify ──
    const verify = await Animal.countDocuments({ prefix: 'TnS', ownerId_public: 'CTU8' });
    const verifyNew = await Animal.countDocuments({ prefix: 'TnS', ownerId_public: 'CTU11' });
    console.log(`\nVerification: TnS on CTU8 = ${verify}, TnS on CTU11 = ${verifyNew}`);

    console.log('\nDone!');
    await mongoose.disconnect();
}

run().catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
});
