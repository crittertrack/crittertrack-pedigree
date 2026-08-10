// One-off: reset CTU8's onboarding flag to false so the WelcomeGuideModal
// first-login flow can be re-tested. (hasCompletedOnboarding field was removed since.)
require('dotenv').config();
const mongoose = require('mongoose');
const { User, PublicProfile } = require('../database/models');

(async () => {
    await mongoose.connect(process.env.MONGODB_URI);
    const user = await User.findOne({ id_public: 'CTU8' }).select('_id id_public').lean();
    if (!user) throw new Error('CTU8 user not found');

    const r = await PublicProfile.updateOne(
        { userId_backend: user._id },
        { $set: { hasSeenProfileSetupGuide: false } }
    );
    console.log(`CTU8 (${user._id}) onboarding flag reset, modified: ${r.modifiedCount}`);
    await mongoose.disconnect();
})();
