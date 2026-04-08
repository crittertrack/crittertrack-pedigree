/**
 * One-time migration: Assign CTU77 to the stuck TEMP user.
 *
 * Problem: TEMP_1775678172050_lel7jpqrf completed registration but the email
 * verification step failed before id_public could be promoted, yet a session
 * was issued. The user is now stuck — emailVerified=false, no valid code,
 * and cannot re-verify because the expected sequence slot is CTU77.
 *
 * Fix:
 *   1. Verify CTU77 is not already in use.
 *   2. Update User: id_public → CTU77, emailVerified → true, clear codes.
 *   3. Create PublicProfile if one does not already exist.
 *
 * Usage:  node migrations/fix-user-TEMP-to-CTU77.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const { User, PublicProfile } = require('../database/models');

const TEMP_ID   = 'TEMP_1775678172050_lel7jpqrf';
const TARGET_ID = 'CTU77';

async function run() {
    const uri = process.env.MONGODB_URI;
    if (!uri) { console.error('MONGODB_URI not set'); process.exit(1); }

    await mongoose.connect(uri);
    console.log('Connected to MongoDB\n');

    // --- Safety check: make sure CTU77 is not already assigned ---
    const existing = await User.findOne({ id_public: TARGET_ID });
    if (existing) {
        console.error(`ABORT: ${TARGET_ID} is already assigned to user ${existing.email} (_id: ${existing._id})`);
        await mongoose.disconnect();
        process.exit(1);
    }

    // --- Find the stuck TEMP user ---
    const user = await User.findOne({ id_public: TEMP_ID })
        .select('+verificationCode +verificationCodeExpires');

    if (!user) {
        console.error(`ABORT: No user found with id_public="${TEMP_ID}"`);
        await mongoose.disconnect();
        process.exit(1);
    }

    console.log(`Found user: ${user.email} (_id: ${user._id})`);
    console.log(`  emailVerified : ${user.emailVerified}`);
    console.log(`  id_public     : ${user.id_public}`);

    // --- Promote the user ---
    user.id_public = TARGET_ID;
    user.emailVerified = true;
    user.verificationCode = undefined;
    user.verificationCodeExpires = undefined;
    await user.save();
    console.log(`\nUser updated: id_public=${user.id_public}, emailVerified=${user.emailVerified}`);

    // --- Ensure PublicProfile exists ---
    const existingProfile = await PublicProfile.findOne({ userId_backend: user._id });
    if (existingProfile) {
        // Sync id_public in case it was written with the TEMP value
        if (existingProfile.id_public !== TARGET_ID) {
            await PublicProfile.updateOne(
                { _id: existingProfile._id },
                { $set: { id_public: TARGET_ID } }
            );
            console.log(`PublicProfile id_public corrected to ${TARGET_ID}`);
        } else {
            console.log('PublicProfile already exists and id_public is correct — no change needed.');
        }
    } else {
        const publicProfile = new PublicProfile({
            userId_backend: user._id,
            id_public: TARGET_ID,
            personalName: user.personalName,
            showPersonalName: user.showPersonalName !== undefined ? user.showPersonalName : true,
            breederName: user.breederName || null,
            showBreederName: user.showBreederName || false,
            profileImage: user.profileImage || null,
            createdAt: user.creationDate || new Date(),
            email: user.email,
            showEmailPublic: user.showEmailPublic || false,
            websiteURL: user.websiteURL || null,
            showWebsiteURL: user.showWebsiteURL || false,
            socialMediaURL: user.socialMediaURL || null,
            showSocialMediaURL: user.showSocialMediaURL || false,
            allowMessages: user.allowMessages !== undefined ? user.allowMessages : true,
            emailNotificationPreference: user.emailNotificationPreference || 'none',
            monthlyDonationActive: user.monthlyDonationActive || false,
            lastDonationDate: user.lastDonationDate || null,
        });
        await publicProfile.save();
        console.log(`PublicProfile created for ${TARGET_ID}`);
    }

    console.log('\nMigration complete.');
    await mongoose.disconnect();
}

run().catch(err => {
    console.error('Migration failed:', err);
    mongoose.disconnect();
    process.exit(1);
});
