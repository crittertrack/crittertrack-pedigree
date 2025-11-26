const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');

const { Animal, PublicProfile, PublicAnimal, User } = require('../database/models');

// POST /api/admin/cleanup-orphans
// Protected by auth middleware; additionally checks that the authenticated
// user's backend id matches ADMIN_USER_ID env var.
router.post('/cleanup-orphans', async (req, res) => {
    try {
        // req.user is supplied by the authMiddleware mounted in index.js
        const adminUser = process.env.ADMIN_USER_ID;
        if (!adminUser) return res.status(500).json({ message: 'ADMIN_USER_ID not configured on server.' });
        if (!req.user || String(req.user.id) !== String(adminUser)) return res.status(403).json({ message: 'Forbidden: admin only.' });

        const uploadsDir = path.join(__dirname, '..', 'uploads');
        const files = fs.existsSync(uploadsDir) ? fs.readdirSync(uploadsDir) : [];
        const referenced = new Set();

        const animals = await Animal.find({}, 'imageUrl photoUrl').lean().catch(() => []);
        animals.forEach(a => { if (a.imageUrl) referenced.add(path.basename(a.imageUrl)); if (a.photoUrl) referenced.add(path.basename(a.photoUrl)); });

        const profiles = await PublicProfile.find({}, 'profileImage').lean().catch(() => []);
        profiles.forEach(p => { if (p.profileImage) referenced.add(path.basename(p.profileImage)); });

        try {
            const pubA = await PublicAnimal.find({}, 'imageUrl').lean();
            pubA.forEach(p => { if (p.imageUrl) referenced.add(path.basename(p.imageUrl)); });
        } catch (e) { /* ignore */ }

        try {
            const users = await User.find({}, 'profileImage').lean();
            users.forEach(u => { if (u.profileImage) referenced.add(path.basename(u.profileImage)); });
        } catch (e) { /* ignore */ }

        const orphanFiles = files.filter(f => !referenced.has(f));
        const missingFiles = [];
        referenced.forEach(fn => { if (!files.includes(fn)) missingFiles.push(fn); });

        // If request body has { delete: true } then remove orphan files
        const doDelete = req.body && req.body.delete === true;
        const deleted = [];
        const failed = [];
        if (doDelete && orphanFiles.length > 0) {
            for (const fn of orphanFiles) {
                try {
                    fs.unlinkSync(path.join(uploadsDir, fn));
                    deleted.push(fn);
                } catch (err) {
                    failed.push({ file: fn, error: err && err.message ? err.message : String(err) });
                }
            }
        }

        return res.json({ orphanFiles, missingFiles, deleted, failed });
    } catch (err) {
        console.error('Admin cleanup error:', err && err.stack ? err.stack : err);
        return res.status(500).json({ message: 'Failed to run cleanup', error: err && err.message ? err.message : String(err) });
    }
});

module.exports = router;
