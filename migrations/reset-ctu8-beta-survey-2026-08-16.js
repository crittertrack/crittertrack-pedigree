require('dotenv').config();
const mongoose = require('mongoose');
const { PublicProfile, BetaSurveyResponse } = require('../database/models');

(async () => {
    await mongoose.connect(process.env.MONGODB_URI);
    const profile = await PublicProfile.findOne({ id_public: 'CTU8' });
    if (!profile) {
        console.log('CTU8 profile not found');
        await mongoose.disconnect();
        return;
    }

    console.log('Before:', profile.betaSurveyStatus, profile.betaSurveyLastPromptedAt);
    profile.betaSurveyStatus = 'pending';
    profile.betaSurveyLastPromptedAt = null;
    await profile.save();

    const deleted = await BetaSurveyResponse.deleteMany({ id_public: 'CTU8' });
    console.log('Deleted responses:', deleted.deletedCount);

    const verify = await PublicProfile.findOne({ id_public: 'CTU8' });
    console.log('After:', verify.betaSurveyStatus, verify.betaSurveyLastPromptedAt);

    await mongoose.disconnect();
})();
