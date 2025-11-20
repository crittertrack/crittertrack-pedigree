const express = require('express');
const router = express.Router();
const { addAnimal, getUsersAnimals, toggleAnimalPublic } = require('../database/db_service');
// The authMiddleware will be passed in from the index.js file

// --- Animal Route Controllers ---

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


// PUT /api/animals/:id_backend/toggle
// 3. Toggles an animal's public visibility.
router.put('/:id_backend/toggle', async (req, res) => {
    try {
        const appUserId_backend = req.user.id;
        const animalId_backend = req.params.id_backend;
        // Expected body: { makePublic: true, includeRemarks: false, includeGeneticCode: true }
        const toggleData = req.body; 

        const updatedAnimal = await toggleAnimalPublic(appUserId_backend, animalId_backend, toggleData);

        res.status(200).json({
            message: `Animal visibility set to ${updatedAnimal.showOnPublicProfile}`,
            showOnPublicProfile: updatedAnimal.showOnPublicProfile
        });
    } catch (error) {
        console.error('Error toggling animal public status:', error);
        // Use 404 if the animal isn't found or doesn't belong to the user
        if (error.message.includes("not found")) {
            return res.status(404).json({ message: error.message });
        }
        res.status(500).json({ message: 'Internal server error while toggling public status.' });
    }
});


module.exports = router;
