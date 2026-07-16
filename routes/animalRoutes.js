﻿const express = require('express');
const router = express.Router();
const { Animal } = require('../database/models');
const { addAnimal, updateAnimal, getUsersAnimals } = require('../database/db_service');
const { protect } = require('../middleware/authMiddleware');

// Apply authentication to all routes
router.use(protect);

// GET /api/animals - Get all animals for the user, with filtering
router.get('/', async (req, res) => {
    try {
        // getUsersAnimals from db_service handles all filtering based on query params
        const animals = await getUsersAnimals(req.user.id, req.query);
        res.json(animals);
    } catch (error) {
        console.error('[ANIMALS] Error fetching animals:', error);
        res.status(500).json({ message: 'Failed to fetch animals', error: error.message });
    }
});

// POST /api/animals - Create a new animal
router.post('/', async (req, res) => {
    try {
        console.log('[ANIMALS] POST /api/animals - Request Body:', req.body);
        // Use the service function which contains all business logic (validation, parent linking, etc.)
        const newAnimal = await addAnimal(req.user.id, req.body);
        res.status(201).json(newAnimal);
    } catch (error) {
        console.error('[ANIMALS] Error creating animal:', error);
        res.status(500).json({ message: 'Failed to create animal', error: error.message });
    }
});

// PUT /api/animals/:id_public - Update an animal
router.put('/:id_public', async (req, res) => {
    try {
        console.log(`[ANIMALS] PUT /api/animals/${req.params.id_public} - Request Body:`, req.body);

        // Find the animal by its public ID to get its internal _id, which the service function needs
        const animal = await Animal.findOne({
            id_public: req.params.id_public,
            creatorId: req.user._id 
        });

        if (!animal) {
            return res.status(404).json({ message: 'Animal not found or you do not have permission to edit it.' });
        }

        // Call the service function with the internal _id. It handles all complex update logic.
        const updatedAnimal = await updateAnimal(req.user.id, animal._id, req.body);

        res.json(updatedAnimal);
    } catch (error) {
        console.error(`[ANIMALS] Error updating animal ${req.params.id_public}:`, error);
        res.status(500).json({ message: 'Failed to update animal', error: error.message });
    }
});

module.exports = router;