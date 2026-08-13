// Site-wide: links every animal with prefix "CWR" to CTU77 as breeder (breederId_public).
require('dotenv').config();
const mongoose = require('mongoose');
const { Animal, PublicAnimal, User } = require('../database/models');

(async () => {
    await mongoose.connect(process.env.MONGODB_URI);

    const ctu77 = await User.findOne({ id_public: 'CTU77' }).select('_id');
    if (!ctu77) throw new Error('CTU77 not found');

    const result = await Animal.updateMany(
        { prefix: 'CWR' },
        { $set: { breederId_public: 'CTU77' } }
    );
    const publicResult = await PublicAnimal.updateMany(
        { prefix: 'CWR' },
        { $set: { breederId_public: 'CTU77' } }
    );

    console.log(`Animal: ${result.matchedCount} matched, ${result.modifiedCount} modified.`);
    console.log(`PublicAnimal: ${publicResult.matchedCount} matched, ${publicResult.modifiedCount} modified.`);

    await mongoose.disconnect();
})();
