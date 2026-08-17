require('dotenv').config();
const mongoose = require('mongoose');
const { PublicProfile } = require('../database/models');

(async () => {
    await mongoose.connect(process.env.MONGODB_URI);
    const profile = await PublicProfile.findOne({ id_public: 'CTU9' });
    if (!profile) {
        console.log('No PublicProfile found for CTU9');
        await mongoose.disconnect();
        return;
    }
    console.log('breedingLineDefs:');
    console.log(JSON.stringify(profile.breedingLineDefs, null, 2));

    const map = profile.animalBreedingLines || {};
    const ids = Object.keys(map);
    console.log('Total animals with any line assignment:', ids.length);

    await mongoose.disconnect();
})();
