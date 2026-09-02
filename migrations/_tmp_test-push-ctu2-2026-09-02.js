require('dotenv').config();
const mongoose = require('mongoose');
const { User } = require('../database/models');
const { sendPushToUser } = require('../utils/pushService');

(async () => {
    await mongoose.connect(process.env.MONGODB_URI);

    const user = await User.findOne({ id_public: 'CTU2' }).select('_id id_public deviceTokens pushSubscriptions');
    console.log('CTU2 deviceTokens:', user?.deviceTokens?.length || 0, 'pushSubscriptions:', user?.pushSubscriptions?.length || 0);

    if (user) {
        await sendPushToUser(user, {
            title: 'CritterTrack test push',
            body: 'If you see this, native push delivery is working end-to-end!',
            url: '/',
            tag: 'test-push',
        }, 'system');
        console.log('sendPushToUser called.');
    } else {
        console.log('User CTU2 not found.');
    }

    await mongoose.disconnect();
})();
