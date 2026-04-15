/**
 * One-time script: Convert TEMP user to CTU80
 *
 * Finds user TEMP_1776163335677_hzz1bn89m and assigns id_public = 'CTU80',
 * marks emailVerified = true, creates PublicProfile if missing, and ensures
 * the userId Counter seq is >= 80 so future signups don't collide.
 *
 * Usage:  node scripts/convert-temp-to-ctu80.js
 */

const mongoose = require('mongoose');
require('dotenv').config();
const { User, PublicProfile, Counter } = require('../database/models');

const TEMP_ID = 'TEMP_1776163335677_hzz1bn89m';
const TARGET_ID = 'CTU80';
const TARGET_SEQ = 80; // numeric portion

(async () => {
    await mongoose.connect(process.env.MONGODB_URI);

    // ── Guard: make sure CTU80 isn't already taken ────────────────────────────
    const existing = await User.findOne({ id_public: TARGET_ID }).lean();
    if (existing) {
        console.error(`ABORT: ${TARGET_ID} is already assigned to user ${existing.email}`);
        await mongoose.disconnect();
        process.exit(1);
    }

    // ── Find the TEMP user ────────────────────────────────────────────────────
    const user = await User.findOne({ id_public: TEMP_ID });
    if (!user) {
        console.error(`ABORT: No user found with id_public = '${TEMP_ID}'`);
        await mongoose.disconnect();
        process.exit(1);
    }

    console.log(`Found TEMP user: ${user.email} (${user._id})`);

    // ── Assign the permanent ID and mark verified ─────────────────────────────
    user.id_public = TARGET_ID;
    user.emailVerified = true;
    user.verificationCode = undefined;
    user.verificationCodeExpires = undefined;
    await user.save();

    console.log(`Updated User.id_public → ${TARGET_ID}`);

    // ── Create PublicProfile if one doesn't exist yet ─────────────────────────
    const profile = await PublicProfile.findOne({ userId_backend: user._id });
    if (!profile) {
        await PublicProfile.create({
            userId_backend: user._id,
            id_public: TARGET_ID,
            personalName: user.personalName,
            showPersonalName: user.showPersonalName !== undefined ? user.showPersonalName : true,
            breederName: user.breederName,
            showBreederName: user.showBreederName || false,
            profileImage: user.profileImage || null,
            createdAt: user.creationDate || new Date(),
            monthlyDonationActive: user.monthlyDonationActive || false,
            lastDonationDate: user.lastDonationDate || null,
        });
        console.log('Created PublicProfile for CTU80');
    } else {
        // Profile exists (e.g. created during import) — update id_public
        profile.id_public = TARGET_ID;
        await profile.save();
        console.log('Updated existing PublicProfile.id_public → CTU80');
    }

    // ── Ensure Counter seq is at least TARGET_SEQ so future signups skip CTU80 ─
    const counter = await Counter.findById('userId');
    if (!counter || counter.seq < TARGET_SEQ) {
        await Counter.findByIdAndUpdate(
            'userId',
            { $set: { seq: TARGET_SEQ } },
            { upsert: true }
        );
        console.log(`Counter 'userId' seq set to ${TARGET_SEQ}`);
    } else {
        console.log(`Counter 'userId' seq is already ${counter.seq} — no update needed`);
    }

    console.log('\nDone! User is now CTU80.');
    await mongoose.disconnect();
})();
