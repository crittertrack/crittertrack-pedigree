/**
 * One-time script: Reset welcome banner for CTU80
 *
 * Sets hasSeenWelcomeBanner = false on CTU80's PublicProfile so the
 * "Welcome to CritterTrack" guide shows again on next login.
 *
 * Usage:  node scripts/reset-ctu80-welcome.js
 */

const mongoose = require('mongoose');
require('dotenv').config();
const { User, PublicProfile } = require('../database/models');

(async () => {
    await mongoose.connect(process.env.MONGODB_URI);

    const user = await User.findOne({ id_public: 'CTU80' }).lean();
    if (!user) {
        console.error('ABORT: No user found with id_public = CTU80');
        await mongoose.disconnect();
        process.exit(1);
    }

    const result = await PublicProfile.updateOne(
        { userId_backend: user._id },
        { $set: { hasSeenWelcomeBanner: false } }
    );

    console.log(`Done! Matched: ${result.matchedCount}, Modified: ${result.modifiedCount}`);
    await mongoose.disconnect();
})();
