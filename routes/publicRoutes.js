const express = require('express');
const router = express.Router();
const { getPublicProfile, getPublicAnimalsByOwner } = require('../database/db_service');

// --- Public Access Route Controllers (NO AUTH REQUIRED) ---

// GET /api/public/profile/:id_public
// 1. Gets a public profile for display.
// This route is used to show a user's public profile page (Breeder Name, Profile Image, etc.)
router.get('/profile/:id_public', async (req, res) => {
    try {
        // Convert the string parameter to a number for querying the id_public field
        const id_public = parseInt(req.params.id_public, 10); 
        
        if (isNaN(id_public)) {
            return res.status(400).json({ message: 'Invalid public ID format.' });
        }

        const profile = await getPublicProfile(id_public);

        // Success: Return the public profile data
        res.status(200).json(profile);
    } catch (error) {
        console.error('Error fetching public profile:', error);
        if (error.message.includes('not found')) {
            // User Public ID doesn't exist
            return res.status(404).json({ message: error.message });
        }
        res.status(500).json({ message: 'Internal server error while fetching public profile.' });
    }
});


// GET /api/public/animals/:ownerId_public
// 2. Gets all publicly visible animals belonging to a specific owner.
// This route is used to populate the list of shared animals on a user's public profile page.
router.get('/animals/:ownerId_public', async (req, res) => {
    try {
        const ownerId_public = parseInt(req.params.ownerId_public, 10);

        if (isNaN(ownerId_public)) {
            return res.status(400).json({ message: 'Invalid public owner ID format.' });
        }

        const animals = await getPublicAnimalsByOwner(ownerId_public);

        // Success: Returns 200 with an array of public animals (can be empty if none are shared).
        res.status(200).json(animals);
    } catch (error) {
        console.error('Error fetching public animals:', error);
        res.status(500).json({ message: 'Internal server error while fetching public animals.' });
    }
});


module.exports = router;
