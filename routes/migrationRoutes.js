const express = require('express');
const router = express.Router();
const { User, PublicProfile } = require('../database/models');

// Migration endpoint to sync privacy settings to PublicProfile
router.post('/sync-privacy-settings', async (req, res) => {
    try {
        // Get all users
        const users = await User.find({});
        console.log(`Found ${users.length} users to migrate`);

        let updated = 0;
        let failed = 0;
        const errors = [];

        for (const user of users) {
            try {
                const result = await PublicProfile.updateOne(
                    { userId_backend: user._id },
                    {
                        $set: {
                            showGeneticCodePublic: user.showGeneticCodePublic ?? false,
                            showRemarksPublic: user.showRemarksPublic ?? false,
                        }
                    }
                );

                if (result.matchedCount > 0) {
                    updated++;
                    console.log(`✓ Updated PublicProfile for user CT${user.id_public}`);
                } else {
                    console.log(`! No PublicProfile found for user CT${user.id_public}`);
                    errors.push(`No PublicProfile found for user CT${user.id_public}`);
                }
            } catch (error) {
                failed++;
                console.error(`✗ Failed to update user CT${user.id_public}:`, error.message);
                errors.push(`Failed CT${user.id_public}: ${error.message}`);
            }
        }

        res.json({
            success: true,
            total: users.length,
            updated,
            failed,
            errors: errors.length > 0 ? errors : undefined
        });

    } catch (error) {
        console.error('Migration failed:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Migration failed', 
            error: error.message 
        });
    }
});

module.exports = router;
