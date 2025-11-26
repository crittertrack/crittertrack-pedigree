/**
 * Script: find_orphan_uploads.js
 * Usage: set MONGODB_URI and run `node scripts/find_orphan_uploads.js` from project root.
 * Output: JSON with `orphanFiles` (files with no DB reference) and `missingFiles` (DB records referencing missing files).
 */
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

const { Animal, PublicProfile, PublicAnimal, User } = require('../database/models');

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
    console.error('MONGODB_URI is required in environment');
    process.exit(2);
}

const uploadsDir = path.join(__dirname, '..', 'uploads');

async function main() {
    await mongoose.connect(MONGODB_URI);

    // Read files
    const files = fs.existsSync(uploadsDir) ? fs.readdirSync(uploadsDir) : [];

    // Gather referenced filenames/paths from DB
    const referenced = new Set();

    // Animals
    const animals = await Animal.find({}, 'imageUrl photoUrl').lean();
    animals.forEach(a => {
        if (a.imageUrl) referenced.add(path.basename(a.imageUrl));
        if (a.photoUrl) referenced.add(path.basename(a.photoUrl));
    });

    // Users / PublicProfile
    const profiles = await PublicProfile.find({}, 'profileImage').lean().catch(()=>[]);
    profiles.forEach(p => { if (p.profileImage) referenced.add(path.basename(p.profileImage)); });

    // PublicAnimal
    try {
        const pubA = await PublicAnimal.find({}, 'imageUrl').lean();
        pubA.forEach(p => { if (p.imageUrl) referenced.add(path.basename(p.imageUrl)); });
    } catch (e) { /* ignore if model not present */ }

    // Users may also have profile image stored on User
    try {
        const users = await User.find({}, 'profileImage').lean();
        users.forEach(u => { if (u.profileImage) referenced.add(path.basename(u.profileImage)); });
    } catch (e) { /* ignore */ }

    const orphanFiles = files.filter(f => !referenced.has(f));
    const missingFiles = [];

    // Find DB referenced files that are missing on disk
    referenced.forEach(fn => { if (!files.includes(fn)) missingFiles.push(fn); });

    const report = { orphanFiles, missingFiles, totalFiles: files.length, referencedCount: referenced.size };
    console.log(JSON.stringify(report, null, 2));

    await mongoose.disconnect();
}

main().catch(err => { console.error(err && err.stack ? err.stack : err); process.exit(1); });
