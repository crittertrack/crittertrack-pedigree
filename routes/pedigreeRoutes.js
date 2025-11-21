const express = require('express');
const router = express.Router();
const { generatePedigree } = require('../database/db_service');

// --- Pedigree Route Controllers (PROTECTED) ---

// GET /api/pedigree/:animalId_backend
// 1. Generates and returns a nested pedigree structure for the specified animal.
router.get('/:animalId_backend', async (req, res) => {
    try {
        // req.user is added by authMiddleware and contains the user's backend _id
        const appUserId_backend = req.user.id; 
        const animalId_backend = req.params.animalId_backend;
        
        // Optional: Number of generations to trace (default to 4)
        const generations = req.query.generations ? parseInt(req.query.generations, 10) : 4;

        if (isNaN(generations) || generations < 1 || generations > 4) {
            return res.status(400).json({ message: 'Generations must be an integer between 1 and 4.' });
        }

        const pedigreeTree = await generatePedigree(appUserId_backend, animalId_backend, generations);

        // [Image of Pedigree Chart Data Structure] 
        res.status(200).json(pedigreeTree);
    } catch (error) {
        console.error('Error generating pedigree:', error);
        if (error.message.includes('not found') || error.message.includes('does not own')) {
            return res.status(404).json({ message: error.message });
        }
        res.status(500).json({ message: 'Internal server error during pedigree generation.' });
    }
});

module.exports = router;
