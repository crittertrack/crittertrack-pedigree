// Site-wide: links every animal with prefix "MM" to CTU2 as breeder (breederId_public),
// regardless of current owner.
require('dotenv').config();
const mongoose = require('mongoose');
const { Animal, PublicAnimal } = require('../database/models');

(async () => {
    await mongoose.connect(process.env.MONGODB_URI);

    const result = await Animal.updateMany(
        { prefix: 'MM' },
        { $set: { breederId_public: 'CTU2' } }
    );
    const publicResult = await PublicAnimal.updateMany(
        { prefix: 'MM' },
        { $set: { breederId_public: 'CTU2' } }
    );

    console.log(`Animal: ${result.matchedCount} matched, ${result.modifiedCount} modified.`);
    console.log(`PublicAnimal: ${publicResult.matchedCount} matched, ${publicResult.modifiedCount} modified.`);

    await mongoose.disconnect();
})();
