/**
 * One-time script: Update email address for CTU80
 *
 * Finds user with id_public = 'CTU80' and sets their email to dbanaantje@live.nl.
 *
 * Usage:  node scripts/update-ctu80-email.js
 */

const mongoose = require('mongoose');
require('dotenv').config();
const { User } = require('../database/models');

const TARGET_ID = 'CTU80';
const NEW_EMAIL = 'dbanaantje@live.nl';

(async () => {
    await mongoose.connect(process.env.MONGODB_URI);

    const user = await User.findOne({ id_public: TARGET_ID });
    if (!user) {
        console.error(`ABORT: No user found with id_public = '${TARGET_ID}'`);
        await mongoose.disconnect();
        process.exit(1);
    }

    console.log(`Found CTU80: current email is ${user.email}`);

    user.email = NEW_EMAIL;
    await user.save();

    console.log(`Done! CTU80 email updated to ${NEW_EMAIL}`);
    await mongoose.disconnect();
})();
