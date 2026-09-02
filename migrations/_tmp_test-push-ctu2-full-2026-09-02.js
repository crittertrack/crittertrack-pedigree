require('dotenv').config();
const mongoose = require('mongoose');
const { User } = require('../database/models');
const { sendPushToUser } = require('../utils/pushService');

(async () => {
    await mongoose.connect(process.env.MONGODB_URI);

    const user = await User.findOne({ id_public: 'CTU2' }).select('_id id_public deviceTokens pushSubscriptions');
    // Target only the second (later-registered) device token — the main "full" app's install.
    const targetToken = user.deviceTokens[1];
    console.log('Sending only to token registered at:', targetToken.createdAt);

    const scopedUser = { ...user.toObject(), deviceTokens: [targetToken] };
    await sendPushToUser(scopedUser, {
        title: 'CritterTrack test push (full app)',
        body: 'This one is for the full CritterTrack app, not Lite.',
        url: '/',
        tag: 'test-push-full',
    }, 'system');
    console.log('sendPushToUser called.');

    await mongoose.disconnect();
})();
