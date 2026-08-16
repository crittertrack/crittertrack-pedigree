require('dotenv').config();
const mongoose = require('mongoose');
const { PublicProfile } = require('../database/models');

(async () => {
    await mongoose.connect(process.env.MONGODB_URI);
    const profile = await PublicProfile.findOne({ id_public: 'CTU1' });
    if (!profile) {
        console.log('CTU1 profile not found');
        await mongoose.disconnect();
        return;
    }

    console.log('Before:', profile.betaSurveyStatus);
    profile.betaSurveyStatus = 'dismissed';
    await profile.save();

    const verify = await PublicProfile.findOne({ id_public: 'CTU1' });
    console.log('After:', verify.betaSurveyStatus);

    await mongoose.disconnect();
})();
