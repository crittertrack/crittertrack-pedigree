require('dotenv').config();
const mongoose = require('mongoose');
const { PublicProfile } = require('../database/models');

(async () => {
    await mongoose.connect(process.env.MONGODB_URI);
    const profile = await PublicProfile.findOne({ id_public: 'CTU8' });
    if (!profile) {
        console.log('CTU8 profile not found');
        await mongoose.disconnect();
        return;
    }

    console.log('Before:', profile.hasSeenProfileSetupGuide);
    profile.hasSeenProfileSetupGuide = false;
    await profile.save();

    const verify = await PublicProfile.findOne({ id_public: 'CTU8' });
    console.log('After:', verify.hasSeenProfileSetupGuide);

    await mongoose.disconnect();
})();
