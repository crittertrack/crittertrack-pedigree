const express = require('express');
const router = express.Router();
const { Species, SpeciesConfig } = require('../database/models');

/**
 * GET /api/species
 * Get all species, optionally filtered by category
 */
router.get('/', async (req, res) => {
    try {
        const { category, search } = req.query;
        let query = {};
        
        if (category) {
            query.category = category;
        }
        
        if (search) {
            query.name = { $regex: search, $options: 'i' }; // Case-insensitive search
        }
        
        const species = await Species.find(query).sort({ isDefault: -1, name: 1 });
        res.json(species);
    } catch (error) {
        console.error('Error fetching species:', error);
        res.status(500).json({ message: 'Failed to fetch species' });
    }
});

/**
 * POST /api/species
 * Add a new custom species (requires authentication - must be applied when mounting route)
 */
router.post('/', async (req, res) => {
    try {
        const { name, latinName, category } = req.body;
        const userId_public = req.user?.id_public || null;
        
        if (!name || !name.trim()) {
            return res.status(400).json({ message: 'Species name is required' });
        }
        
        const trimmedName = name.trim();
        
        // Check if species already exists (case-insensitive)
        const existingSpecies = await Species.findOne({ 
            name: { $regex: `^${trimmedName}$`, $options: 'i' } 
        });
        
        if (existingSpecies) {
            return res.status(409).json({ 
                message: `Species "${existingSpecies.name}" already exists`,
                existing: existingSpecies 
            });
        }
        
        // Create new species
        const newSpecies = new Species({
            name: trimmedName,
            latinName: latinName && latinName.trim() ? latinName.trim() : null,
            category: category || 'Other',
            isDefault: false,
            createdBy_public: userId_public
        });
        
        await newSpecies.save();
        
        res.status(201).json({ 
            message: `Species "${trimmedName}" created successfully`,
            species: newSpecies 
        });
    } catch (error) {
        console.error('Error creating species:', error);
        res.status(500).json({ message: 'Failed to create species' });
    }
});

/**
 * GET /api/species/categories
 * Get list of all available categories
 */
router.get('/categories', (req, res) => {
    const categories = ['Mammal', 'Reptile', 'Bird', 'Amphibian', 'Fish', 'Invertebrate', 'Other'];
    res.json(categories);
});

/**
 * GET /api/species/config/:speciesName
 * Get public config for a species (fieldReplacements and hiddenFields only)
 * This is a public endpoint for the frontend to use for dynamic labels
 */
router.get('/config/:speciesName', async (req, res) => {
    try {
        const { speciesName } = req.params;
        
        const config = await SpeciesConfig.findOne({ speciesName, isActive: true });
        
        if (!config) {
            // Return empty config - frontend will use default labels
            return res.json({
                speciesName,
                fieldReplacements: {},
                hiddenFields: []
            });
        }
        
        // Only return public-safe fields
        res.json({
            speciesName: config.speciesName,
            fieldReplacements: config.fieldReplacements || {},
            hiddenFields: config.hiddenFields || []
        });
    } catch (error) {
        console.error('Error fetching species config:', error);
        res.status(500).json({ message: 'Failed to fetch species config' });
    }
});

/**
 * GET /api/species/configs
 * Get all species configs in one call (for caching on frontend)
 */
router.get('/configs', async (req, res) => {
    try {
        const configs = await SpeciesConfig.find({ isActive: true });
        
        // Convert to a map keyed by speciesName
        const configMap = {};
        configs.forEach(config => {
            configMap[config.speciesName] = {
                fieldReplacements: config.fieldReplacements || {},
                hiddenFields: config.hiddenFields || []
            };
        });
        
        res.json(configMap);
    } catch (error) {
        console.error('Error fetching species configs:', error);
        res.status(500).json({ message: 'Failed to fetch species configs' });
    }
});

/**
 * POST /api/species/migrate-categories
 * One-time migration to add categories to existing species
 */
router.post('/migrate-categories', async (req, res) => {
    try {
        const defaultSpecies = ['Mouse', 'Rat', 'Hamster'];
        const results = {
            updated: [],
            created: [],
            skipped: []
        };
        
        // Update/create default species with Mammal category
        for (const speciesName of defaultSpecies) {
            const existing = await Species.findOne({ name: speciesName });
            
            if (existing) {
                if (!existing.category || existing.category === 'Other' || !existing.isDefault) {
                    existing.category = 'Mammal';
                    existing.isDefault = true;
                    await existing.save();
                    results.updated.push(speciesName);
                } else {
                    results.skipped.push(speciesName);
                }
            } else {
                const newSpecies = new Species({
                    name: speciesName,
                    category: 'Mammal',
                    isDefault: true
                });
                await newSpecies.save();
                results.created.push(speciesName);
            }
        }
        
        // Set default category for species without one
        const updateResult = await Species.updateMany(
            { category: { $exists: false } },
            { $set: { category: 'Other' } }
        );
        
        res.json({
            success: true,
            results,
            uncategorizedUpdated: updateResult.modifiedCount,
            message: 'Migration completed successfully'
        });
    } catch (error) {
        console.error('Error migrating species categories:', error);
        res.status(500).json({ error: 'Migration failed', details: error.message });
    }
});

module.exports = router;
