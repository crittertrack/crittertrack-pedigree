// Counts animals where showOnPublicProfile and isDisplay have drifted out of sync
// (they're supposed to always be set together by the app).
require('dotenv').config();
const mongoose = require('mongoose');
const { Animal } = require('../database/models');

(async () => {
    await mongoose.connect(process.env.MONGODB_URI);

    const mismatched = await Animal.find({
        $expr: { $ne: ['$showOnPublicProfile', '$isDisplay'] }
    }).select('id_public name prefix showOnPublicProfile isDisplay creatorId_public').lean();

    console.log(`${mismatched.length} animal(s) with showOnPublicProfile !== isDisplay:\n`);
    mismatched.forEach(a => {
        console.log(`${a.id_public}\t${a.prefix || ''} ${a.name}\towner:${a.creatorId_public}\tshowOnPublicProfile:${a.showOnPublicProfile}\tisDisplay:${a.isDisplay}`);
    });

    await mongoose.disconnect();
})();
