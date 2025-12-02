const express = require('express');
const router = express.Router();
const { User, PublicProfile } = require('../database/models');

// Admin endpoint to migrate public profiles
// GET /api/admin/migrate-public-profiles
router.get('/migrate-public-profiles', async (req, res) => {
    try {
        // Get all public profiles
        const publicProfiles = await PublicProfile.find({});
        console.log(`Found ${publicProfiles.length} public profiles to migrate`);

        let updated = 0;
        let failed = 0;
        const results = [];

        for (const profile of publicProfiles) {
            try {
                // Get corresponding user
                const user = await User.findById(profile.userId_backend);
                
                if (!user) {
                    results.push({ id_public: profile.id_public, status: 'failed', reason: 'User not found' });
                    failed++;
                    continue;
                }

                // Update the public profile with missing fields
                await PublicProfile.updateOne(
                    { _id: profile._id },
                    {
                        personalName: user.personalName,
                        showBreederName: user.showBreederName || false,
                        breederName: user.breederName || null
                    }
                );

                results.push({ 
                    id_public: profile.id_public, 
                    status: 'success',
                    personalName: user.personalName,
                    breederName: user.breederName,
                    showBreederName: user.showBreederName
                });
                updated++;
            } catch (error) {
                results.push({ id_public: profile.id_public, status: 'failed', reason: error.message });
                failed++;
            }
        }

        res.status(200).json({
            message: 'Migration complete',
            total: publicProfiles.length,
            updated,
            failed,
            results
        });
    } catch (error) {
        console.error('Migration error:', error);
        res.status(500).json({ message: 'Migration failed', error: error.message });
    }
});

module.exports = router;
