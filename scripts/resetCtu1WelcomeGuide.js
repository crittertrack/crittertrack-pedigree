// One-off: re-enables the first-login Welcome Guide modal for CTU1 by clearing the backend
// flag (PublicProfile.hasSeenProfileSetupGuide - same field the admin reset route
// /api/users/:id/reset-profile-setup-guide uses). Only touches that one field on that one profile.
// Note: the frontend also caches "seen" in the browser's localStorage under
// `<userId>_hasSeenWelcomeGuide`, so that key must be cleared in each browser too.
require('dotenv').config();
const mongoose = require('mongoose');

(async () => {
    await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 60000 });
    const M = require('../database/models.js');
    const profile = await M.PublicProfile.findOne({ id_public: 'CTU1' }).select('_id id_public userId_backend hasSeenProfileSetupGuide').lean();
    if (!profile) throw new Error('CTU1 public profile not found');
    console.log(`Before: hasSeenProfileSetupGuide=${profile.hasSeenProfileSetupGuide} (userId_backend ${profile.userId_backend})`);

    const res = await M.PublicProfile.updateOne({ _id: profile._id }, { $set: { hasSeenProfileSetupGuide: false } });
    console.log(`matched ${res.matchedCount}, modified ${res.modifiedCount}`);

    const after = await M.PublicProfile.findOne({ _id: profile._id }).select('hasSeenProfileSetupGuide').lean();
    console.log(`After: hasSeenProfileSetupGuide=${after.hasSeenProfileSetupGuide}`);
    console.log(`Browser cache key to clear: ${profile.userId_backend}_hasSeenWelcomeGuide`);
    await mongoose.disconnect();
})().catch(err => { console.error(err.message); process.exit(1); });
