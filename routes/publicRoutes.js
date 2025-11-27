const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { getPublicProfile, getPublicAnimalsByOwner } = require('../database/db_service');
const { PublicAnimal, Animal } = require('../database/models');

// --- Public Access Route Controllers (NO AUTH REQUIRED) ---

// GET /api/public/profile/:id_public
// 1. Gets a public profile for display.
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

// Serve uploaded files at GET /api/uploads/:filename
// Note: this router is expected to be mounted at '/api' in the main server,
// so this will respond to '/api/uploads/<filename>'.
router.get('/uploads/:filename', (req, res) => {
    try {
        const uploadsDir = path.join(__dirname, '..', 'uploads');
        const filename = path.basename(req.params.filename);
        const filePath = path.join(uploadsDir, filename);
        if (!fs.existsSync(filePath)) return res.status(404).send('Not found');
        return res.sendFile(filePath);
    } catch (err) {
        console.error('Error serving upload file:', err);
        return res.status(500).send('Server error');
    }
});

// --- Global/Public search for animals (public endpoint) ---
// Support query: /api/global/animals?display=true&name=...&id_public=...&gender=...&birthdateBefore=YYYY-MM-DD
router.get('/global/animals', async (req, res) => {
    try {
        const Model = (typeof PublicAnimal !== 'undefined' && PublicAnimal) ? PublicAnimal : Animal;
        const q = {};
        const query = req.query || {};

        if (query.display === 'true' || query.display === '1') {
            q.isDisplay = true;
        }

        if (query.name) {
            q.name = { $regex: query.name, $options: 'i' };
        }

        if (query.id_public) {
            const n = Number(query.id_public);
            if (!isNaN(n)) q.id_public = n;
        }

        if (query.gender) {
            q.gender = query.gender;
        }

        if (query.birthdateBefore) {
            const dt = new Date(query.birthdateBefore);
            if (!isNaN(dt.getTime())) {
                // assume birthDate stored as ISO date string or Date — use <= filter
                q.birthDate = { $lte: dt.toISOString().split('T')[0] };
            }
        }

        const limit = Math.min(parseInt(query.limit || '50', 10) || 50, 500);

        const docs = await Model.find(q).limit(limit).lean();
        return res.status(200).json(docs);
    } catch (error) {
        console.error('Error fetching global animals:', error && (error.stack || error));
        return res.status(500).json({ message: 'Internal server error while fetching global animals.' });
    }
});