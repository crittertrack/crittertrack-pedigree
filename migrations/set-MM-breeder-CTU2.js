/**
 * One-time migration: Set breederId_public = 'CTU2' for all animals with prefix 'MM'.
 *
 * Updates both Animal and PublicAnimal collections.
 *
 * Usage:  node migrations/set-MM-breeder-CTU2.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const { Animal, PublicAnimal } = require('../database/models');

async function run() {
    const uri = process.env.MONGODB_URI;
    if (!uri) { console.error('MONGODB_URI not set'); process.exit(1); }

    await mongoose.connect(uri);
    console.log('Connected to MongoDB\n');

    // --- Dry-run counts ---
    const animalCount = await Animal.countDocuments({ prefix: 'MM' });
    const publicCount = await PublicAnimal.countDocuments({ prefix: 'MM' });
    console.log(`Found ${animalCount} Animal docs with prefix "MM"`);
    console.log(`Found ${publicCount} PublicAnimal docs with prefix "MM"\n`);

    if (animalCount === 0 && publicCount === 0) {
        console.log('Nothing to update.');
        await mongoose.disconnect();
        return;
    }

    // --- Show current breeder distribution before update ---
    const animalBreederDist = await Animal.aggregate([
        { $match: { prefix: 'MM' } },
        { $group: { _id: '$breederId_public', count: { $sum: 1 } } }
    ]);
    console.log('Current breeder distribution (Animal):');
    animalBreederDist.forEach(g => console.log(`  ${g._id || '(null)'}: ${g.count}`));
    console.log();

    // --- Update Animal collection ---
    const animalResult = await Animal.updateMany(
        { prefix: 'MM' },
        { $set: { breederId_public: 'CTU2' } }
    );
    console.log(`Animal: matched ${animalResult.matchedCount}, modified ${animalResult.modifiedCount}`);

    // --- Update PublicAnimal collection ---
    const publicResult = await PublicAnimal.updateMany(
        { prefix: 'MM' },
        { $set: { breederId_public: 'CTU2' } }
    );
    console.log(`PublicAnimal: matched ${publicResult.matchedCount}, modified ${publicResult.modifiedCount}`);

    console.log('\nDone!');
    await mongoose.disconnect();
}

run().catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
});
