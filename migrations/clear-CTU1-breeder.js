/**
 * One-time migration: Clear breederId_public where it is 'CTU1'.
 * Sets breederId_public to null on both Animal and PublicAnimal collections.
 *
 * Usage:  node migrations/clear-CTU1-breeder.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const { Animal, PublicAnimal } = require('../database/models');

async function run() {
    const uri = process.env.MONGODB_URI;
    if (!uri) { console.error('MONGODB_URI not set'); process.exit(1); }

    await mongoose.connect(uri);
    console.log('Connected to MongoDB\n');

    const animalCount = await Animal.countDocuments({ breederId_public: 'CTU1' });
    const publicCount = await PublicAnimal.countDocuments({ breederId_public: 'CTU1' });
    console.log(`Found ${animalCount} Animal docs with breederId_public = "CTU1"`);
    console.log(`Found ${publicCount} PublicAnimal docs with breederId_public = "CTU1"\n`);

    if (animalCount > 0) {
        const dist = await Animal.aggregate([
            { $match: { breederId_public: 'CTU1' } },
            { $group: { _id: '$prefix', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]);
        console.log('Animal prefix distribution:');
        dist.forEach(g => console.log(`  ${g._id || '(null)'}: ${g.count}`));
        console.log();
    }

    const animalResult = await Animal.updateMany(
        { breederId_public: 'CTU1' },
        { $set: { breederId_public: null } }
    );
    console.log(`Animal: matched ${animalResult.matchedCount}, modified ${animalResult.modifiedCount}`);

    const publicResult = await PublicAnimal.updateMany(
        { breederId_public: 'CTU1' },
        { $set: { breederId_public: null } }
    );
    console.log(`PublicAnimal: matched ${publicResult.matchedCount}, modified ${publicResult.modifiedCount}`);

    console.log('\nDone!');
    await mongoose.disconnect();
}

run().catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
});
