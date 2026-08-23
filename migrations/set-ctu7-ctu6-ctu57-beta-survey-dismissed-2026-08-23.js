require('dotenv').config();
const mongoose = require('mongoose');
const { PublicProfile } = require('../database/models');

const ids = ['CTU7', 'CTU6', 'CTU57'];

(async () => {
    await mongoose.connect(process.env.MONGODB_URI);

    for (const id of ids) {
        const profile = await PublicProfile.findOne({ id_public: id });
        if (!profile) {
            console.log(`${id}: profile not found`);
            continue;
        }
        console.log(`${id} Before:`, profile.betaSurveyStatus);
        profile.betaSurveyStatus = 'dismissed';
        await profile.save();
        const verify = await PublicProfile.findOne({ id_public: id });
        console.log(`${id} After:`, verify.betaSurveyStatus);
    }

    await mongoose.disconnect();
})();
