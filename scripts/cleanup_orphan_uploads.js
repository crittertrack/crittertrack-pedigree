/**
 * Script: cleanup_orphan_uploads.js
 * Usage:
 *   # Dry run (report only)
 *   node scripts/cleanup_orphan_uploads.js
 *
 *   # Execute deletion (non-interactive)
 *   node scripts/cleanup_orphan_uploads.js --yes
 *
 * The script uses MONGODB_URI from environment to connect and will
 * remove files from the uploads directory that are not referenced
 * by any Animal/User/PublicProfile records.
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
const doDelete = process.argv.includes('--yes');

async function main() {
    await mongoose.connect(MONGODB_URI);

    const files = fs.existsSync(uploadsDir) ? fs.readdirSync(uploadsDir) : [];
    const referenced = new Set();

    const animals = await Animal.find({}, 'imageUrl photoUrl').lean().catch(() => []);
    animals.forEach(a => { if (a.imageUrl) referenced.add(path.basename(a.imageUrl)); if (a.photoUrl) referenced.add(path.basename(a.photoUrl)); });

    const profiles = await PublicProfile.find({}, 'profileImage').lean().catch(() => []);
    profiles.forEach(p => { if (p.profileImage) referenced.add(path.basename(p.profileImage)); });

    try {
        const pubA = await PublicAnimal.find({}, 'imageUrl').lean();
        pubA.forEach(p => { if (p.imageUrl) referenced.add(path.basename(p.imageUrl)); });
    } catch (e) { /* ignore if model not present */ }

    try {
        const users = await User.find({}, 'profileImage').lean();
        users.forEach(u => { if (u.profileImage) referenced.add(path.basename(u.profileImage)); });
    } catch (e) { /* ignore */ }

    const orphanFiles = files.filter(f => !referenced.has(f));
    const missingFiles = [];
    referenced.forEach(fn => { if (!files.includes(fn)) missingFiles.push(fn); });

    const report = { orphanFiles, missingFiles, totalFiles: files.length, referencedCount: referenced.size };

    console.log('Cleanup Report:', JSON.stringify(report, null, 2));

    if (doDelete) {
        if (orphanFiles.length === 0) {
            console.log('No orphan files to delete.');
        } else {
            console.log(`Deleting ${orphanFiles.length} orphan files...`);
            orphanFiles.forEach(fn => {
                try {
                    const p = path.join(uploadsDir, fn);
                    fs.unlinkSync(p);
                    console.log('Deleted', fn);
                } catch (err) {
                    console.warn('Failed to delete', fn, err && err.message ? err.message : err);
                }
            });
        }
    } else {
        console.log('Dry run complete. To delete orphan files re-run with --yes');
    }

    await mongoose.disconnect();
}

main().catch(err => { console.error(err && err.stack ? err.stack : err); process.exit(1); });
