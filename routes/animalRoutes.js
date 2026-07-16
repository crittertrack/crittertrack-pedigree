﻿const express = require('express');
const router = express.Router();
const { Animal } = require('../database/models');
const { protect } = require('../middleware/authMiddleware');

// Apply authentication to all routes
router.use(protect);

// POST /api/animals - Create a new animal
router.post('/', async (req, res) => {
    try {
        console.log('[ANIMALS] POST /api/animals - Request Body:', req.body);

        // Destructure all expected fields from the form
        const {
            name,
            species,
            gender,
            status,
            birthDate,
            // ... other fields from your form
            ownerId_public, // New field for linked owner
            ownerName,      // New field for manual owner name
            breederId_public,
            manualBreederName,
        } = req.body;

        // Basic validation
        if (!name || !species || !gender || !status) {
            return res.status(400).json({ message: 'Name, species, gender, and status are required.' });
        }

        const newAnimal = new Animal({
            ...req.body, // Pass through all fields from the form
            creatorId: req.user._id,
            userId: req.user._id, // Assuming animals are tied to the user
            
            // Explicitly handle the new owner fields
            ownerId_public: ownerId_public || null,
            ownerName: ownerName || '', // Use ownerName for manual entry

            // Also explicitly handle breeder fields for consistency
            breederId_public: breederId_public || null,
            manualBreederName: manualBreederName || '',
        });

        console.log('[ANIMALS] New Animal Object before save:', newAnimal);
        await newAnimal.save();
        console.log('[ANIMALS] New Animal Object after save:', newAnimal);

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

        const animal = await Animal.findOne({
            id_public: req.params.id_public,
            // Ensure user can only edit their own animals
            creatorId: req.user._id 
        });

        if (!animal) {
            return res.status(404).json({ message: 'Animal not found or you do not have permission to edit it.' });
        }

        console.log('[ANIMALS] Animal Object before update:', animal);

        // Destructure all expected fields from the form
        const {
            name,
            species,
            gender,
            status,
            birthDate,
            // ... other fields from your form
            ownerId_public, // New field for linked owner
            ownerName,      // New field for manual owner name
            breederId_public,
            manualBreederName,
        } = req.body;

        // Update all fields from the request body
        Object.assign(animal, req.body);

        // Explicitly handle the new owner fields to ensure they are saved correctly
        animal.ownerId_public = ownerId_public || null;
        animal.ownerName = ownerName; // Trust the frontend to send an empty string or a name

        // Also explicitly handle breeder fields for consistency
        animal.breederId_public = breederId_public || null;
        animal.manualBreederName = manualBreederName || '';

        console.log('[ANIMALS] Animal Object before save:', animal);
        await animal.save();
        console.log('[ANIMALS] Animal Object after save:', animal);

        res.json(animal);
    } catch (error) {
        console.error(`[ANIMALS] Error updating animal ${req.params.id_public}:`, error);
        res.status(500).json({ message: 'Failed to update animal', error: error.message });
    }
});

// You would have other routes here like GET, DELETE, etc.
// This is a simplified file focusing on the fix.

module.exports = router;