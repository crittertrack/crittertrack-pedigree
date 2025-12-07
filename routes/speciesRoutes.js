const express = require('express');
const router = express.Router();
const { Species } = require('../database/models');
const authMiddleware = require('../middleware/authMiddleware');

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
 * Add a new custom species (requires authentication)
 */
router.post('/', authMiddleware, async (req, res) => {
    try {
        const { name, category } = req.body;
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
    const categories = ['Rodent', 'Mammal', 'Reptile', 'Bird', 'Amphibian', 'Fish', 'Invertebrate', 'Other'];
    res.json(categories);
});

module.exports = router;
