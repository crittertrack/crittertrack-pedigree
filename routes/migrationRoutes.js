const express = require('express');
const router = express.Router();
const { User, PublicProfile, Animal, PublicAnimal, Species } = require('../database/models');

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
 * POST /api/migrations/rename-species
 * Migration to rename old species names to new ones and update all references
 * This handles: Mouse → Fancy Mouse, Rat → Fancy Rat, Hamster → specific hamster types
 * Also handles Guinea Pig renaming from user-created to default
 */
router.post('/rename-species', async (req, res) => {
    try {
        const { Animal, PublicAnimal, Species } = require('../database/models');
        
        // Mapping of old names to new names
        const renameMap = {
            'Mouse': 'Fancy Mouse',
            'Rat': 'Fancy Rat',
            'Hamster': 'Russian Dwarf Hamster', // Default hamster to Russian Dwarf
            'Guinea Pig': 'Guinea Pig' // Ensure Guinea Pig is handled
        };
        
        let updates = {};
        
        // First, rename species in the database
        for (const [oldName, newName] of Object.entries(renameMap)) {
            const oldSpecies = await Species.findOne({ name: oldName });
            if (oldSpecies) {
                updates[oldName] = { old: oldSpecies._id, oldName };
                
                // Check if new species exists
                let newSpecies = await Species.findOne({ name: newName });
                if (!newSpecies) {
                    // Create new species if it doesn't exist
                    const newSpeciesData = {
                        Mouse: { latinName: 'Mus musculus', category: 'Rodent', isDefault: true },
                        Rat: { latinName: 'Rattus norvegicus', category: 'Rodent', isDefault: true },
                        'Russian Dwarf Hamster': { latinName: 'Phodopus sungorus', category: 'Rodent', isDefault: true },
                        'Guinea Pig': { latinName: 'Cavia porcellus', category: 'Rodent', isDefault: true }
                    };
                    
                    newSpecies = await Species.create({
                        name: newName,
                        ...newSpeciesData[newName],
                        createdBy_public: null
                    });
                }
                
                updates[oldName].new = newSpecies._id;
                updates[oldName].newName = newName;
                
                console.log(`Species mapping ready: ${oldName} (${oldSpecies._id}) → ${newName} (${newSpecies._id})`);
            }
        }
        
        // Update all Animal references
        let animalUpdates = 0;
        for (const [oldName, mapping] of Object.entries(updates)) {
            const result = await Animal.updateMany(
                { species: oldName },
                { $set: { species: mapping.newName } }
            );
            animalUpdates += result.modifiedCount;
            console.log(`Updated ${result.modifiedCount} Animals from "${oldName}" to "${mapping.newName}"`);
        }
        
        // Update all PublicAnimal references
        let publicAnimalUpdates = 0;
        for (const [oldName, mapping] of Object.entries(updates)) {
            const result = await PublicAnimal.updateMany(
                { species: oldName },
                { $set: { species: mapping.newName } }
            );
            publicAnimalUpdates += result.modifiedCount;
            console.log(`Updated ${result.modifiedCount} PublicAnimals from "${oldName}" to "${mapping.newName}"`);
        }
        
        res.json({
            success: true,
            message: 'Species renamed successfully',
            animalUpdates,
            publicAnimalUpdates,
            mappings: Object.keys(updates).map(oldName => ({
                from: oldName,
                to: updates[oldName].newName
            }))
        });
        
    } catch (error) {
        console.error('Error renaming species:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to rename species',
            error: error.message
        });
    }
});

module.exports = router;
