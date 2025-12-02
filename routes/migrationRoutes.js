const express = require('express');
const router = express.Router();
const { User, PublicProfile, Animal, PublicAnimal } = require('../database/models');

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

// Migration endpoint to sync animal data to PublicAnimal based on owner privacy settings
router.post('/sync-animal-privacy', async (req, res) => {
    try {
        // Get all public animals
        const publicAnimals = await PublicAnimal.find({});
        console.log(`Found ${publicAnimals.length} public animals to update`);

        let updated = 0;
        let failed = 0;
        const errors = [];

        for (const publicAnimal of publicAnimals) {
            try {
                // Find the owner
                const owner = await User.findOne({ id_public: publicAnimal.ownerId_public });
                if (!owner) {
                    console.log(`! No owner found for animal CT${publicAnimal.id_public}`);
                    errors.push(`No owner found for animal CT${publicAnimal.id_public}`);
                    continue;
                }

                // Find the private animal record
                const privateAnimal = await Animal.findOne({ id_public: publicAnimal.id_public });
                if (!privateAnimal) {
                    console.log(`! No private animal found for CT${publicAnimal.id_public}`);
                    errors.push(`No private animal found for CT${publicAnimal.id_public}`);
                    continue;
                }

                // Update public animal with privacy-respecting data
                const updateData = {
                    remarks: owner.showRemarksPublic ? (privateAnimal.remarks || '') : '',
                    geneticCode: owner.showGeneticCodePublic ? (privateAnimal.geneticCode || null) : null,
                };

                await PublicAnimal.updateOne(
                    { id_public: publicAnimal.id_public },
                    { $set: updateData }
                );

                updated++;
                console.log(`✓ Updated animal CT${publicAnimal.id_public}`);
            } catch (error) {
                failed++;
                console.error(`✗ Failed to update animal CT${publicAnimal.id_public}:`, error.message);
                errors.push(`Failed CT${publicAnimal.id_public}: ${error.message}`);
            }
        }

        res.json({
            success: true,
            total: publicAnimals.length,
            updated,
            failed,
            errors: errors.length > 0 ? errors : undefined
        });

    } catch (error) {
        console.error('Animal migration failed:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Animal migration failed', 
            error: error.message 
        });
    }
});

module.exports = router;
