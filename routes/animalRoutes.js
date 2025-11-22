const express = require('express');
const router = express.Router();
const { 
    addAnimal, 
    getUsersAnimals, 
    updateAnimal, 
    toggleAnimalPublic,
    getAnimalByIdAndUser // Assuming this helper exists
} = require('../database/db_service');
// This router requires authMiddleware to be applied in index.js

// --- Animal Route Controllers (PROTECTED) ---\

// POST /api/animals
// 1. Registers a new animal under the logged-in user.
router.post('/', async (req, res) => {
    try {
        // req.user is added by authMiddleware and contains the user's backend _id
        const appUserId_backend = req.user.id; 
        const animalData = req.body;

        const newAnimal = await addAnimal(appUserId_backend, animalData);

        res.status(201).json({
            message: 'Animal registered successfully!',
            id_public: newAnimal.id_public,
            animalId_backend: newAnimal._id
        });
    } catch (error) {
        console.error('Error registering animal:', error);
        res.status(500).json({ message: 'Internal server error during animal registration.' });
    }
});

// GET /api/animals
// 2. Gets all animals for the logged-in user (private list).
router.get('/', async (req, res) => {
    try {
        const appUserId_backend = req.user.id;
        // Optionally pass query filters (e.g., ?gender=Male)
        const filters = req.query; 

        const animals = await getUsersAnimals(appUserId_backend, filters);

        res.status(200).json(animals);
    } catch (error) {
        console.error('Error fetching user animals:', error);
        res.status(500).json({ message: 'Internal server error while fetching animals.' });
    }
});

// GET /api/animals/:id_backend
// 3. Gets a single animal by its internal ID for viewing/editing.
router.get('/:id_backend', async (req, res) => {
    try {
        const appUserId_backend = req.user.id;
        const animalId_backend = req.params.id_backend;

        // Assuming a helper function to ensure ownership
        const animal = await getAnimalByIdAndUser(appUserId_backend, animalId_backend);
        
        res.status(200).json(animal);
    } catch (error) {
        console.error('Error fetching single animal:', error);
        if (error.message.includes("not found") || error.message.includes("does not own")) {
            return res.status(404).json({ message: error.message });
        }
        res.status(500).json({ message: 'Internal server error while fetching animal.' });
    }
});

// PUT /api/animals/:id_backend
// 4. Updates an existing animal's record.
router.put('/:id_backend', async (req, res) => {
    try {
        const appUserId_backend = req.user.id;
        const animalId_backend = req.params.id_backend;
        const updates = req.body; // Updates object

        const updatedAnimal = await updateAnimal(appUserId_backend, animalId_backend, updates);

        res.status(200).json({
            message: 'Animal updated successfully!',
            animal: updatedAnimal
        });
    } catch (error) {
        console.error('Error updating animal:', error);
        // Use 404 if the animal isn't found or doesn't belong to the user
        if (error.message.includes("not found") || error.message.includes("does not own")) {
            return res.status(404).json({ message: error.message });
        }
        res.status(500).json({ message: 'Internal server error during animal update.' });
    }
});


// PUT /api/animals/:id_backend/toggle
// 5. Toggles an animal's public visibility.
router.put('/:id_backend/toggle', async (req, res) => {
    try {
        const appUserId_backend = req.user.id;
        const animalId_backend = req.params.id_backend;
        // Expected body: { makePublic: true, includeRemarks: false, includeGeneticCode: true }
        const toggleData = req.body; 

        const updatedAnimal = await toggleAnimalPublic(appUserId_backend, animalId_backend, toggleData);

        res.status(200).json({
            message: `Animal visibility set to ${updatedAnimal.showOnPublicProfile ? 'public' : 'private'}`,
            showOnPublicProfile: updatedAnimal.showOnPublicProfile
        });
    } catch (error) {
        console.error('Error toggling animal public status:', error);
        // Use 404 if the animal isn't found or doesn't belong to the user
        if (error.message.includes("not found")) {
            return res.status(404).json({ message: error.message });
        }
        res.status(500).json({ message: 'Internal server error during public toggle.' });
    }
});

module.exports = router;