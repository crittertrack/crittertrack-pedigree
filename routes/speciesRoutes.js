const express = require('express');
const router = express.Router();
const { Species, SpeciesConfig, FieldTemplate } = require('../database/models');

/**
 * GET /api/species
 * Get all species, optionally filtered by category
 * Includes field template data if includeTemplate=true query param is provided
 */
router.get('/', async (req, res) => {
    try {
        const { category, search, includeTemplate } = req.query;
        let query = {};
        
        if (category) {
            query.category = category;
        }
        
        if (search) {
            query.name = { $regex: search, $options: 'i' }; // Case-insensitive search
        }
        
        // Optionally populate field template data
        let speciesQuery = Species.find(query).sort({ isDefault: -1, name: 1 });
        
        if (includeTemplate === 'true') {
            speciesQuery = speciesQuery.populate('fieldTemplateId');
        }
        
        const species = await speciesQuery;
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
 * GET /api/species/with-template/:speciesName
 * Get a specific species with its field template populated
 * This is the main endpoint for the frontend to get template configuration
 * Falls back to category-based template mapping if species has no template assigned
 */
router.get('/with-template/:speciesName', async (req, res) => {
    try {
        const { speciesName } = req.params;
        
        const species = await Species.findOne({ name: speciesName }).populate('fieldTemplateId');
        
        if (!species) {
            return res.status(404).json({ message: `Species "${speciesName}" not found` });
        }
        
        let fieldTemplate = species.fieldTemplateId;
        
        // If no template assigned, map by category
        if (!fieldTemplate) {
            // Category to template mapping (use Other as default for any edge cases)
            const categoryTemplateMap = {
                'Small Mammal': 'Small Mammal Template',
                'Mammal': 'Full Mammal Template',
                'Reptile': 'Reptile Template',
                'Bird': 'Bird Template',
                'Fish': 'Fish Template',
                'Amphibian': 'Amphibian Template',
                'Invertebrate': 'Invertebrate Template',
                'Other': 'Other Template'
            };
            
            // Default to 'Other Template' if category is missing or unknown
            const templateName = categoryTemplateMap[species.category] || 'Other Template';
            
            // Fetch the template by name - GRACEFULLY handle if templates don't exist yet
            try {
                fieldTemplate = await FieldTemplate.findOne({ name: templateName });
                
                if (!fieldTemplate) {
                    // Final fallback: try to get 'Other Template' directly
                    fieldTemplate = await FieldTemplate.findOne({ name: 'Other Template' });
                }
            } catch (templateError) {
                console.warn('Field templates not yet seeded in database:', templateError.message);
                // Continue without template - legacy UI will be used
                fieldTemplate = null;
            }
        }
        
        // Return species with populated field template (or null if not available)
        res.json({
            name: species.name,
            latinName: species.latinName,
            category: species.category,
            isDefault: species.isDefault,
            fieldTemplate: fieldTemplate || null,
            mappedByCategory: !species.fieldTemplateId  // Indicates if template was mapped by category
        });
    } catch (error) {
        console.error('Error fetching species with template:', error);
        // Return species data even if template fetch fails
        try {
            const species = await Species.findOne({ name: req.params.speciesName });
            if (species) {
                res.json({
                    name: species.name,
                    latinName: species.latinName,
                    category: species.category,
                    isDefault: species.isDefault,
                    fieldTemplate: null,
                    mappedByCategory: false
                });
            } else {
                res.status(500).json({ message: 'Failed to fetch species template' });
            }
        } catch (fallbackError) {
            res.status(500).json({ message: 'Failed to fetch species template' });
        }
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
