// Site-wide: links every animal with suffix "MafiaSpade" to CTU4 as breeder (breederId_public).
require('dotenv').config();
const mongoose = require('mongoose');
const { Animal, PublicAnimal, User } = require('../database/models');

(async () => {
    await mongoose.connect(process.env.MONGODB_URI);

    const ctu4 = await User.findOne({ id_public: 'CTU4' }).select('_id');
    if (!ctu4) throw new Error('CTU4 not found');

    const result = await Animal.updateMany(
        { suffix: 'MafiaSpade' },
        { $set: { breederId_public: 'CTU4' } }
    );
    const publicResult = await PublicAnimal.updateMany(
        { suffix: 'MafiaSpade' },
        { $set: { breederId_public: 'CTU4' } }
    );

    console.log(`Animal: ${result.matchedCount} matched, ${result.modifiedCount} modified.`);
    console.log(`PublicAnimal: ${publicResult.matchedCount} matched, ${publicResult.modifiedCount} modified.`);

    await mongoose.disconnect();
})();
