// One-off: backfill showPersonalName=true for existing users who have no breeder name
// publicly shown (showBreederName: false) and were fully anonymous (showPersonalName: false).
// Registration was fixed to default showPersonalName: true going forward; this catches
// users who registered before that fix. Users who already show a breeder name, or who
// already have showPersonalName: true, are left untouched.
require('dotenv').config();
const mongoose = require('mongoose');
const { User, PublicProfile } = require('../database/models');

(async () => {
    await mongoose.connect(process.env.MONGODB_URI);

    const targets = await PublicProfile.find({
        showBreederName: { $ne: true },
        showPersonalName: { $ne: true }
    }).select('_id userId_backend id_public').lean();

    console.log(`Found ${targets.length} profiles to update.`);

    const profileIds = targets.map(t => t._id);
    const userIds = targets.map(t => t.userId_backend);

    const profileResult = await PublicProfile.updateMany(
        { _id: { $in: profileIds } },
        { $set: { showPersonalName: true } }
    );
    const userResult = await User.updateMany(
        { _id: { $in: userIds } },
        { $set: { showPersonalName: true } }
    );

    console.log(`PublicProfile modified: ${profileResult.modifiedCount}`);
    console.log(`User modified: ${userResult.modifiedCount}`);

    await mongoose.disconnect();
})();
