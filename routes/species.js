const express = require('express');
const router = express.Router();
const { Species } = require('../database/models');

// GET /api/species - Get all species
router.get('/', async (req, res) => {
    try {
        const species = await Species.find({}).sort({ isDefault: -1, name: 1 });
        // Add cache control headers to prevent stale data
        res.set({
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
        });
        res.json(species);
    } catch (error) {
        console.error('Error fetching species:', error);
        res.status(500).json({ error: 'Failed to fetch species' });
    }
});

// POST /api/species - Add a new species
router.post('/', async (req, res) => {
    try {
        const { name, category } = req.body;
        
        if (!name || !category) {
            return res.status(400).json({ error: 'Name and category are required' });
        }

        // Check if species already exists
        const existing = await Species.findOne({ name });
        if (existing) {
            return res.status(409).json({ 
                error: 'Species already exists',
                existing 
            });
        }

        const newSpecies = new Species({
            name,
            category,
            isDefault: false
        });

        await newSpecies.save();
        res.status(201).json({ species: newSpecies });
    } catch (error) {
        console.error('Error adding species:', error);
        res.status(500).json({ error: 'Failed to add species' });
    }
});

// POST /api/species/migrate-categories - One-time migration to add categories
router.post('/migrate-categories', async (req, res) => {
    try {
        const defaultSpecies = ['Mouse', 'Rat', 'Hamster'];
        const results = {
            updated: [],
            created: [],
            skipped: []
        };
        
        // Update/create default species with Rodent category
        for (const speciesName of defaultSpecies) {
            const existing = await Species.findOne({ name: speciesName });
            
            if (existing) {
                if (!existing.category || !existing.isDefault) {
                    existing.category = 'Rodent';
                    existing.isDefault = true;
                    await existing.save();
                    results.updated.push(speciesName);
                } else {
                    results.skipped.push(speciesName);
                }
            } else {
                const newSpecies = new Species({
                    name: speciesName,
                    category: 'Rodent',
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
            uncategorizedUpdated: updateResult.modifiedCount
        });
    } catch (error) {
        console.error('Error migrating species categories:', error);
        res.status(500).json({ error: 'Migration failed', details: error.message });
    }
});

module.exports = router;
