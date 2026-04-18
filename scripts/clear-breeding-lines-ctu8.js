/**
 * clear-breeding-lines-ctu8.js
 * Removes all breeding line definitions and animal assignments from CTU8's profile.
 * Run with: node scripts/clear-breeding-lines-ctu8.js
 */
const mongoose = require('mongoose');
require('dotenv').config();
const { PublicProfile } = require('../database/models');

(async () => {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const result = await PublicProfile.updateOne(
        { id_public: 'CTU8' },
        { $set: { breedingLineDefs: [], animalBreedingLines: {} } }
    );

    console.log(`Modified: ${result.modifiedCount}`);
    console.log('CTU8 breeding lines cleared.');
    await mongoose.disconnect();
})();
