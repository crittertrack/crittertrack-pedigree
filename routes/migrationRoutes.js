const express = require('express');
const router = express.Router();
const { User, PublicProfile, Animal, PublicAnimal, Species } = require('../database/models');

// Migration endpoint to sync privacy settings to PublicProfile (DEPRECATED)
router.post('/sync-privacy-settings', async (req, res) => {
    // This endpoint is deprecated - showGeneticCodePublic and showRemarksPublic have been removed
    // Privacy is now controlled per-animal via sectionPrivacy
    res.json({
        success: false,
        message: 'This endpoint is deprecated. Privacy settings are now controlled per-animal via sectionPrivacy.'
    });
});

// Migration endpoint to sync animal data to PublicAnimal based on sectionPrivacy settings
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
                // Find the private animal record
                const privateAnimal = await Animal.findOne({ id_public: publicAnimal.id_public });
                if (!privateAnimal) {
                    console.log(`! No private animal found for CT${publicAnimal.id_public}`);
                    errors.push(`No private animal found for CT${publicAnimal.id_public}`);
                    continue;
                }

                // Use animal's sectionPrivacy settings (per-animal privacy control)
                const sectionPrivacy = privateAnimal.sectionPrivacy || {};
                const showRemarks = sectionPrivacy.remarks !== false; // Default to true if not set
                const showGeneticCode = sectionPrivacy.geneticCode !== false; // Default to true if not set

                // Update public animal with privacy-respecting data
                const updateData = {
                    remarks: showRemarks ? (privateAnimal.remarks || '') : '',
                    geneticCode: showGeneticCode ? (privateAnimal.geneticCode || null) : null,
                    sectionPrivacy: privateAnimal.sectionPrivacy || {},
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

/**
 * POST /api/migrations/seed-default-species
 * One-time migration to seed default species
 */
router.post('/seed-default-species', async (req, res) => {
    try {
        const defaultSpecies = [
            { name: 'Fancy Mouse', latinName: 'Mus musculus', category: 'Rodent', isDefault: true, createdBy_public: null },
            { name: 'Fancy Rat', latinName: 'Rattus norvegicus', category: 'Rodent', isDefault: true, createdBy_public: null },
            { name: 'Russian Dwarf Hamster', latinName: 'Phodopus sungorus', category: 'Rodent', isDefault: true, createdBy_public: null },
            { name: 'Campbells Dwarf Hamster', latinName: 'Phodopus campbelli', category: 'Rodent', isDefault: true, createdBy_public: null },
            { name: 'Chinese Dwarf Hamster', latinName: 'Cricetulus barabensis', category: 'Rodent', isDefault: true, createdBy_public: null },
            { name: 'Syrian Hamster', latinName: 'Mesocricetus auratus', category: 'Rodent', isDefault: true, createdBy_public: null },
            { name: 'Guinea Pig', latinName: 'Cavia porcellus', category: 'Rodent', isDefault: true, createdBy_public: null }
        ];
        
        let created = 0;
        let skipped = 0;
        
        for (const species of defaultSpecies) {
            const existing = await Species.findOne({ name: species.name });
            if (!existing) {
                await Species.create(species);
                created++;
                console.log(`✓ Created default species: ${species.name}`);
            } else {
                // Update to ensure it's marked as default
                await Species.updateOne(
                    { name: species.name },
                    { $set: { isDefault: true, category: species.category } }
                );
                skipped++;
                console.log(`! Species already exists: ${species.name} (updated to default)`);
            }
        }
        
        res.json({ 
            success: true,
            message: 'Default species seeded successfully',
            created,
            skipped,
            total: defaultSpecies.length
        });
    } catch (error) {
        console.error('Error seeding default species:', error);
        res.status(500).json({ 
            success: false,
            message: 'Failed to seed default species', 
            error: error.message 
        });
    }
});

/**
 * POST /api/migrations/cleanup-species
 * Comprehensive cleanup: remove old species, migrate animals, update latin names
 */
router.post('/cleanup-species', async (req, res) => {
    try {
        const { Animal, PublicAnimal, Species } = require('../database/models');
        
        const results = {
            animalsMigrated: 0,
            publicAnimalsMigrated: 0,
            speciesRemoved: 0,
            latinNamesUpdated: 0,
            customSpeciesRenamed: 0
        };
        
        // Step 1: Update latin names for new species
        const speciesLatinUpdates = [
            { name: 'Fancy Mouse', latinName: 'Mus musculus' },
            { name: 'Fancy Rat', latinName: 'Rattus norvegicus' }
        ];
        
        for (const spec of speciesLatinUpdates) {
            const result = await Species.updateOne(
                { name: spec.name },
                { $set: { latinName: spec.latinName } }
            );
            if (result.modifiedCount > 0) {
                results.latinNamesUpdated++;
                console.log(`✓ Updated latin name for ${spec.name}`);
            }
        }
        
        // Step 2: Rename custom "Guinea pig" (lowercase) to "Guinea Pig" (proper case)
        const guineaPigCustom = await Species.findOne({ name: 'Guinea pig', isDefault: false });
        if (guineaPigCustom) {
            // Migrate any animals using lowercase version
            await Animal.updateMany(
                { species: 'Guinea pig' },
                { $set: { species: 'Guinea Pig' } }
            );
            await PublicAnimal.updateMany(
                { species: 'Guinea pig' },
                { $set: { species: 'Guinea Pig' } }
            );
            // Remove the custom species
            await Species.deleteOne({ name: 'Guinea pig' });
            results.customSpeciesRenamed++;
            console.log(`✓ Renamed custom "Guinea pig" to "Guinea Pig" and removed old species`);
        }
        
        // Step 3: Migrate animals from old species names
        const migrations = [
            { from: 'Mouse', to: 'Fancy Mouse' },
            { from: 'Rat', to: 'Fancy Rat' },
            { from: 'Hamster', to: 'Russian Dwarf Hamster' }
        ];
        
        for (const migration of migrations) {
            // Migrate Animals
            const animalResult = await Animal.updateMany(
                { species: migration.from },
                { $set: { species: migration.to } }
            );
            results.animalsMigrated += animalResult.modifiedCount;
            
            // Migrate PublicAnimals
            const publicResult = await PublicAnimal.updateMany(
                { species: migration.from },
                { $set: { species: migration.to } }
            );
            results.publicAnimalsMigrated += publicResult.modifiedCount;
            
            if (animalResult.modifiedCount > 0 || publicResult.modifiedCount > 0) {
                console.log(`✓ Migrated ${animalResult.modifiedCount} animals and ${publicResult.modifiedCount} public animals from "${migration.from}" to "${migration.to}"`);
            }
        }
        
        // Step 4: Remove old species (after all animals have been migrated)
        for (const migration of migrations) {
            const result = await Species.deleteOne({ name: migration.from });
            if (result.deletedCount > 0) {
                results.speciesRemoved++;
                console.log(`✓ Removed old species: ${migration.from}`);
            }
        }
        
        res.json({
            success: true,
            message: 'Species cleanup completed successfully',
            ...results
        });
        
    } catch (error) {
        console.error('Error during species cleanup:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to cleanup species',
            error: error.message
        });
    }
});

// Fix specific animal's viewOnlyForUsers array
router.post('/fix-animal-viewonly', async (req, res) => {
    try {
        const { animalId, removeUserId } = req.body;
        
        if (!animalId || !removeUserId) {
            return res.status(400).json({
                success: false,
                message: 'Missing animalId or removeUserId'
            });
        }

        // Find the animal
        const animal = await Animal.findOne({ id_public: animalId });
        
        if (!animal) {
            return res.status(404).json({
                success: false,
                message: `Animal ${animalId} not found`
            });
        }

        // Find the user's backend ID
        const userProfile = await PublicProfile.findOne({ id_public: removeUserId });
        
        if (!userProfile) {
            return res.status(404).json({
                success: false,
                message: `User ${removeUserId} not found`
            });
        }

        const userBackendId = userProfile.userId_backend;

        // Check if user is in viewOnlyForUsers
        const hasViewOnly = animal.viewOnlyForUsers.some(
            userId => userId.toString() === userBackendId.toString()
        );

        if (!hasViewOnly) {
            return res.json({
                success: true,
                message: `User ${removeUserId} is not in viewOnlyForUsers for ${animalId}`,
                alreadyFixed: true
            });
        }

        // Remove user from viewOnlyForUsers
        animal.viewOnlyForUsers = animal.viewOnlyForUsers.filter(
            userId => userId.toString() !== userBackendId.toString()
        );
        
        await animal.save();

        res.json({
            success: true,
            message: `Successfully removed ${removeUserId} from viewOnlyForUsers for ${animalId}`,
            animal: {
                id_public: animal.id_public,
                name: animal.name,
                viewOnlyForUsers: animal.viewOnlyForUsers
            }
        });

    } catch (error) {
        console.error('Error fixing animal viewOnly:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fix animal viewOnly',
            error: error.message
        });
    }
});

// Migration: Enable allowMessages for all existing users
router.post('/enable-allow-messages', async (req, res) => {
    try {
        console.log('[Migration] Starting allowMessages migration...');

        // Update all Users where allowMessages is not set, null, or false
        const userResult = await User.updateMany(
            { $or: [{ allowMessages: null }, { allowMessages: undefined }, { allowMessages: false }] },
            { allowMessages: true }
        );
        console.log(`[Migration] Updated ${userResult.modifiedCount} User documents`);

        // Update all PublicProfiles where allowMessages is not set, null, or false
        const profileResult = await PublicProfile.updateMany(
            { $or: [{ allowMessages: null }, { allowMessages: undefined }, { allowMessages: false }] },
            { allowMessages: true }
        );
        console.log(`[Migration] Updated ${profileResult.modifiedCount} PublicProfile documents`);

        // Verify the updates
        const userCount = await User.countDocuments({ allowMessages: true });
        const profileCount = await PublicProfile.countDocuments({ allowMessages: true });

        const result = {
            message: 'Migration completed successfully',
            usersUpdated: userResult.modifiedCount,
            profilesUpdated: profileResult.modifiedCount,
            totalUsersEnabled: userCount,
            totalProfilesEnabled: profileCount,
        };

        console.log('[Migration] Result:', result);
        res.json(result);
    } catch (error) {
        console.error('[Migration] Error:', error);
        res.status(500).json({ error: 'Migration failed', details: error.message });
    }
});

// Migration: Set emailNotificationPreference to 'none' for all existing users without this field
router.post('/set-email-notification-defaults', async (req, res) => {
    try {
        console.log('[Migration] Starting emailNotificationPreference migration...');

        // Update all Users where emailNotificationPreference is not set, null, or undefined
        const userResult = await User.updateMany(
            { 
                $or: [
                    { emailNotificationPreference: null }, 
                    { emailNotificationPreference: undefined },
                    { emailNotificationPreference: { $exists: false } }
                ] 
            },
            { emailNotificationPreference: 'none' }
        );
        console.log(`[Migration] Updated ${userResult.modifiedCount} User documents`);

        // Update all PublicProfiles where emailNotificationPreference is not set, null, or undefined
        const profileResult = await PublicProfile.updateMany(
            { 
                $or: [
                    { emailNotificationPreference: null }, 
                    { emailNotificationPreference: undefined },
                    { emailNotificationPreference: { $exists: false } }
                ] 
            },
            { emailNotificationPreference: 'none' }
        );
        console.log(`[Migration] Updated ${profileResult.modifiedCount} PublicProfile documents`);

        // Verify the updates
        const userCount = await User.countDocuments({ emailNotificationPreference: { $exists: true } });
        const profileCount = await PublicProfile.countDocuments({ emailNotificationPreference: { $exists: true } });

        const result = {
            message: 'Email notification preference migration completed successfully',
            usersUpdated: userResult.modifiedCount,
            profilesUpdated: profileResult.modifiedCount,
            totalUsersWithPreference: userCount,
            totalProfilesWithPreference: profileCount,
        };

        console.log('[Migration] Result:', result);
        res.json(result);
    } catch (error) {
        console.error('[Migration] Error:', error);
        res.status(500).json({ error: 'Migration failed', details: error.message });
    }
});

module.exports = router;
