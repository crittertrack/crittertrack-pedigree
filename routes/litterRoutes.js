const express = require('express');
const router = express.Router();
const { addLitter, getUsersLitters } = require('../database/db_service');
// The authMiddleware will be passed in from the index.js file

// --- Litter Route Controllers (PROTECTED) ---

// POST /api/litters
// 1. Registers a new litter under the logged-in user.
router.post('/', async (req, res) => {
    try {
        // req.user is added by authMiddleware and contains the user's backend _id
        const appUserId_backend = req.user.id; 
        const litterData = req.body;

        // Basic validation for required fields
        if (!litterData.sireId_public || !litterData.damId_public || !litterData.birthDate || litterData.numberBorn === undefined) {
             return res.status(400).json({ message: 'Missing required litter fields: sireId, damId, birthDate, and numberBorn.' });
        }

        const newLitter = await addLitter(appUserId_backend, litterData);

        res.status(201).json({
            message: 'Litter registered successfully!',
            litterId_backend: newLitter._id
        });
    } catch (error) {
        console.error('Error registering litter:', error);
        res.status(500).json({ message: 'Internal server error during litter registration.' });
    }
});


// GET /api/litters
// 2. Gets all litters for the logged-in user (private list).
router.get('/', async (req, res) => {
    try {
        const appUserId_backend = req.user.id;
        
        const litters = await getUsersLitters(appUserId_backend);

        res.status(200).json(litters);
    } catch (error) {
        console.error('Error fetching user litters:', error);
        res.status(500).json({ message: 'Internal server error while fetching litters.' });
    }
});


module.exports = router;
