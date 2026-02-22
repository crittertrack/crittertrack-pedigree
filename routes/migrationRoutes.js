const express = require('express');
const router = express.Router();
const { User, PublicProfile, Animal, PublicAnimal, Species, FieldTemplate } = require('../database/models');

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
            { name: 'Fancy Mouse', latinName: 'Mus musculus', category: 'Mammal', isDefault: true, createdBy_public: null },
            { name: 'Fancy Rat', latinName: 'Rattus norvegicus', category: 'Mammal', isDefault: true, createdBy_public: null },
            { name: 'Russian Dwarf Hamster', latinName: 'Phodopus sungorus', category: 'Mammal', isDefault: true, createdBy_public: null },
            { name: 'Campbells Dwarf Hamster', latinName: 'Phodopus campbelli', category: 'Mammal', isDefault: true, createdBy_public: null },
            { name: 'Chinese Dwarf Hamster', latinName: 'Cricetulus barabensis', category: 'Mammal', isDefault: true, createdBy_public: null },
            { name: 'Syrian Hamster', latinName: 'Mesocricetus auratus', category: 'Mammal', isDefault: true, createdBy_public: null },
            { name: 'Guinea Pig', latinName: 'Cavia porcellus', category: 'Mammal', isDefault: true, createdBy_public: null }
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

// Migration: Fix isOwned flag for all animals owned by a specific user or all users
router.post('/fix-animal-ownership', async (req, res) => {
    try {
        const { userId_public } = req.body; // Optional: specific user, or all users if not provided
        
        console.log(`[Migration] Starting isOwned flag fix${userId_public ? ` for user ${userId_public}` : ' for all users'}...`);

        let query = {};
        if (userId_public) {
            query.ownerId_public = userId_public;
        }

        // Find all animals (for specific user or all)
        const animals = await Animal.find(query);
        console.log(`[Migration] Found ${animals.length} animals to check`);

        let updated = 0;
        let alreadyCorrect = 0;
        let failed = 0;
        const errors = [];

        for (const animal of animals) {
            try {
                // Animals with an ownerId_public should have isOwned: true
                // Animals without an ownerId_public should have isOwned: false
                const shouldBeOwned = !!animal.ownerId_public;
                
                if (animal.isOwned !== shouldBeOwned) {
                    animal.isOwned = shouldBeOwned;
                    await animal.save();
                    updated++;
                    console.log(`✓ Fixed ${animal.id_public} (${animal.name}): isOwned set to ${shouldBeOwned}`);
                } else {
                    alreadyCorrect++;
                }
            } catch (error) {
                failed++;
                console.error(`✗ Failed to update animal ${animal.id_public}:`, error.message);
                errors.push(`Failed ${animal.id_public}: ${error.message}`);
            }
        }

        // Also update PublicAnimal collection
        const publicAnimals = await PublicAnimal.find(query);
        console.log(`[Migration] Found ${publicAnimals.length} public animals to check`);

        let publicUpdated = 0;
        let publicAlreadyCorrect = 0;

        for (const publicAnimal of publicAnimals) {
            try {
                const shouldBeOwned = !!publicAnimal.ownerId_public;
                
                if (publicAnimal.isOwned !== shouldBeOwned) {
                    publicAnimal.isOwned = shouldBeOwned;
                    await publicAnimal.save();
                    publicUpdated++;
                    console.log(`✓ Fixed public ${publicAnimal.id_public}: isOwned set to ${shouldBeOwned}`);
                } else {
                    publicAlreadyCorrect++;
                }
            } catch (error) {
                failed++;
                console.error(`✗ Failed to update public animal ${publicAnimal.id_public}:`, error.message);
                errors.push(`Failed public ${publicAnimal.id_public}: ${error.message}`);
            }
        }

        const result = {
            success: true,
            message: 'Animal ownership flag fix completed',
            scope: userId_public ? `user ${userId_public}` : 'all users',
            privateAnimals: {
                total: animals.length,
                updated,
                alreadyCorrect
            },
            publicAnimals: {
                total: publicAnimals.length,
                updated: publicUpdated,
                alreadyCorrect: publicAlreadyCorrect
            },
            failed,
            errors: errors.length > 0 ? errors : undefined
        };

        console.log('[Migration] Result:', result);
        res.json(result);

    } catch (error) {
        console.error('[Migration] Error fixing animal ownership:', error);
        res.status(500).json({ 
            success: false,
            error: 'Migration failed', 
            details: error.message 
        });
    }
});

// Migration: create dedicated field templates for Fancy Rat and Fancy Mouse
// Disables phenotype, markings, eyeColor, nailColor, and all exercise/grooming fields
router.post('/setup-rat-mouse-templates', async (req, res) => {
    try {
        const FIELDS_TO_DISABLE = [
            'phenotype', 'markings', 'eyeColor', 'nailColor',
            'exerciseRequirements', 'dailyExerciseMinutes',
            'groomingNeeds', 'sheddingLevel',
            'crateTrained', 'litterTrained', 'leashTrained'
        ];

        const baseTemplate = await FieldTemplate.findOne({ name: 'Small Mammal Template' });
        if (!baseTemplate) {
            return res.status(404).json({ success: false, error: 'Small Mammal Template not found. Run species seed first.' });
        }

        const results = [];

        for (const speciesName of ['Fancy Rat', 'Fancy Mouse']) {
            const templateName = `${speciesName} Template`;

            // Remove old version if exists
            await FieldTemplate.deleteOne({ name: templateName });

            // Clone base template fields, override the fields to disable
            const fieldsObj = baseTemplate.toObject().fields;
            for (const field of FIELDS_TO_DISABLE) {
                if (fieldsObj[field]) {
                    fieldsObj[field].enabled = false;
                }
            }

            const newTemplate = new FieldTemplate({
                name: templateName,
                description: `Custom template for ${speciesName} — disables phenotype, markings, eye/nail color, exercise & grooming`,
                isDefault: false,
                fields: fieldsObj
            });
            await newTemplate.save();

            // Assign to Species
            const species = await Species.findOne({ name: speciesName });
            if (species) {
                species.fieldTemplateId = newTemplate._id;
                await species.save();
                results.push({ speciesName, templateId: newTemplate._id, status: 'ok' });
            } else {
                results.push({ speciesName, templateId: newTemplate._id, status: 'template created but species not found' });
            }
        }

        res.json({ success: true, results });
    } catch (error) {
        console.error('[Migration] setup-rat-mouse-templates error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Migration: disable microchipNumber in Small Mammal/Fancy Rat/Fancy Mouse templates,
// and ensure breederAssignedId is enabled in every template.
router.post('/fix-small-mammal-id-fields', async (req, res) => {
    try {
        const templates = await FieldTemplate.find({});
        const smallMammalNames = ['Small Mammal Template', 'Fancy Rat Template', 'Fancy Mouse Template'];
        const results = [];

        for (const tmpl of templates) {
            let changed = false;

            // Ensure breederAssignedId is always enabled
            if (tmpl.fields?.breederAssignedId && tmpl.fields.breederAssignedId.enabled !== true) {
                tmpl.fields.breederAssignedId.enabled = true;
                changed = true;
            }

            // Disable microchipNumber for small mammal templates
            if (smallMammalNames.includes(tmpl.name) && tmpl.fields?.microchipNumber) {
                if (tmpl.fields.microchipNumber.enabled !== false) {
                    tmpl.fields.microchipNumber.enabled = false;
                    changed = true;
                }
            }

            if (changed) {
                tmpl.markModified('fields');
                await tmpl.save();
                results.push({ name: tmpl.name, updated: true });
            } else {
                results.push({ name: tmpl.name, updated: false });
            }
        }

        res.json({ success: true, results });
    } catch (error) {
        console.error('[Migration] fix-small-mammal-id-fields error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Rename breederyId → breederAssignedId in Animal, PublicAnimal, and FieldTemplate collections
router.post('/rename-breederyid-field', async (req, res) => {
    try {
        const { Animal, PublicAnimal, FieldTemplate } = require('../database/models');

        // $rename on Animal and PublicAnimal documents
        const animalResult = await Animal.updateMany(
            { breederyId: { $exists: true } },
            { $rename: { breederyId: 'breederAssignedId' } }
        );
        const publicResult = await PublicAnimal.updateMany(
            { breederyId: { $exists: true } },
            { $rename: { breederyId: 'breederAssignedId' } }
        );

        // Update FieldTemplate documents: move fields.breederyId → fields.breederAssignedId
        const templates = await FieldTemplate.find({ 'fields.breederyId': { $exists: true } });
        let templatesFixed = 0;
        for (const tmpl of templates) {
            if (tmpl.fields?.breederyId) {
                tmpl.fields.breederAssignedId = tmpl.fields.breederyId;
                tmpl.fields.breederyId = undefined;
                tmpl.markModified('fields');
                await tmpl.save();
                templatesFixed++;
            }
        }

        console.log(`[Migration] rename-breederyid-field: animals=${animalResult.modifiedCount}, public=${publicResult.modifiedCount}, templates=${templatesFixed}`);
        res.json({
            success: true,
            animalsRenamed: animalResult.modifiedCount,
            publicAnimalsRenamed: publicResult.modifiedCount,
            templatesFixed
        });
    } catch (error) {
        console.error('[Migration] rename-breederyid-field error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Update breederAssignedId label in all field templates to "Identification"
router.post('/fix-breederassignedid-label', async (req, res) => {
    try {
        const { FieldTemplate } = require('../database/models');
        const templates = await FieldTemplate.find({ 'fields.breederAssignedId': { $exists: true } });
        let updated = 0;
        for (const tmpl of templates) {
            if (tmpl.fields?.breederAssignedId) {
                tmpl.fields.breederAssignedId.label = 'Identification';
                tmpl.markModified('fields');
                await tmpl.save();
                updated++;
            }
        }
        console.log(`[Migration] fix-breederassignedid-label: ${updated} templates updated`);
        res.json({ success: true, templatesUpdated: updated });
    } catch (error) {
        console.error('[Migration] fix-breederassignedid-label error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
