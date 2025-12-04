const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { getPublicProfile, getPublicAnimalsByOwner } = require('../database/db_service');
const { PublicAnimal, Animal, PublicProfile } = require('../database/models');

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

// --- Global/Public search for users/breeders (public endpoint) ---
// Support query: /api/public/profiles/search?query=...&limit=50
router.get('/profiles/search', async (req, res) => {
    try {
        const { query, limit } = req.query;
        const searchLimit = Math.min(parseInt(limit || '50', 10) || 50, 500);
        
        let filter = {};
        if (query && query.trim()) {
            const searchTerm = query.trim();
            // Search by breederName, personalName, or id_public
            // Handle both numeric IDs and CT-prefixed IDs (e.g., "5" or "CT5")
            const idMatch = searchTerm.match(/^(?:CT[- ]?)?(\d+)$/i);
            if (idMatch) {
                // If query is numeric (with or without CT prefix), search by id_public or in names
                const numericId = parseInt(idMatch[1], 10);
                filter.$or = [
                    { id_public: numericId },
                    { breederName: { $regex: searchTerm, $options: 'i' } },
                    { personalName: { $regex: searchTerm, $options: 'i' } }
                ];
            } else {
                // Otherwise search by breederName or personalName
                filter.$or = [
                    { breederName: { $regex: searchTerm, $options: 'i' } },
                    { personalName: { $regex: searchTerm, $options: 'i' } }
                ];
            }
        }
        
        const profiles = await PublicProfile.find(filter)
            .limit(searchLimit)
            .lean();
        
        res.status(200).json(profiles);
    } catch (error) {
        console.error('Error searching public profiles:', error);
        res.status(500).json({ message: 'Internal server error while searching profiles.' });
    }
});

// TEMPORARY MIGRATION ENDPOINT - Remove after running once
router.get('/migrate-profiles-temp', async (req, res) => {
    try {
        const { User, PublicProfile } = require('../database/models');
        const publicProfiles = await PublicProfile.find({});
        let updated = 0;
        const results = [];

        for (const profile of publicProfiles) {
            const user = await User.findById(profile.userId_backend);
            if (user) {
                await PublicProfile.updateOne(
                    { _id: profile._id },
                    {
                        personalName: user.personalName,
                        showBreederName: user.showBreederName || false,
                        breederName: user.breederName || null
                    }
                );
                results.push({ id: profile.id_public, personalName: user.personalName, breederName: user.breederName });
                updated++;
            }
        }
        res.json({ updated, results });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Debug endpoint to check PublicAnimal count
router.get('/public-animals-count', async (req, res) => {
    try {
        const count = await PublicAnimal.countDocuments();
        const sample = await PublicAnimal.find().limit(3).lean();
        return res.status(200).json({ count, sample });
    } catch (error) {
        console.error('Error counting public animals:', error);
        return res.status(500).json({ message: 'Error counting public animals' });
    }
});

// --- Get single public animal by id_public ---
// GET /api/public/animal/:id_public
router.get('/animal/:id_public', async (req, res) => {
    try {
        const id_public = parseInt(req.params.id_public, 10);
        
        if (isNaN(id_public)) {
            return res.status(400).json({ message: 'Invalid animal ID format.' });
        }

        const animal = await PublicAnimal.findOne({ id_public }).lean();
        
        if (!animal) {
            return res.status(404).json({ message: 'Public animal not found.' });
        }

        return res.status(200).json(animal);
    } catch (error) {
        console.error('Error fetching public animal:', error);
        return res.status(500).json({ message: 'Internal server error while fetching public animal.' });
    }
});

// --- Global/Public search for animals (public endpoint) ---
// Support query: /api/global/animals?display=true&name=...&id_public=...&gender=...&birthdateBefore=YYYY-MM-DD
router.get('/global/animals', async (req, res) => {
    try {
        const Model = (typeof PublicAnimal !== 'undefined' && PublicAnimal) ? PublicAnimal : Animal;
        const q = {};
        const query = req.query || {};

        console.log('Global animals search - Model:', Model.modelName, 'Query params:', query);

        // Note: PublicAnimal collection only contains public animals, so we don't need to filter by isDisplay
        // The display parameter is kept for API compatibility but not used when querying PublicAnimal

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

        console.log('Global animals search - Query filter:', q, 'Limit:', limit);
        const docs = await Model.find(q).limit(limit).lean();
        console.log('Global animals search - Results count:', docs.length);
        return res.status(200).json(docs);
    } catch (error) {
        console.error('Error fetching global animals:', error && (error.stack || error));
        return res.status(500).json({ message: 'Internal server error while fetching global animals.' });
    }
});

// --- Get offspring for a specific animal (public endpoint) ---
// GET /api/public/animal/:id_public/offspring
// Works for both authenticated and unauthenticated users
// Authenticated: returns ALL offspring (private + public)
// Unauthenticated: returns only PUBLIC offspring
router.get('/animal/:id_public/offspring', async (req, res) => {
    try {
        const { id_public } = req.params;
        const animalIdPublic = parseInt(id_public, 10);

        if (isNaN(animalIdPublic)) {
            return res.status(400).json({ message: 'Invalid animal ID.' });
        }

        const { Litter, Animal } = require('../database/models');
        
        // Check if request has authentication (optional)
        // Note: This route is public, so req.user may or may not exist
        const authHeader = req.headers.authorization;
        let authenticatedUserId = null;
        
        if (authHeader && authHeader.startsWith('Bearer ')) {
            try {
                const jwt = require('jsonwebtoken');
                const token = authHeader.substring(7);
                const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
                authenticatedUserId = decoded.id;
            } catch (err) {
                // Invalid token, treat as unauthenticated
                console.log('Invalid token in public offspring endpoint, treating as unauthenticated');
            }
        }

        const isAuthenticated = !!authenticatedUserId;

        // Find all offspring where this animal is either sire or dam
        let allOffspring = [];

        if (isAuthenticated) {
            // For authenticated users: get ALL offspring from user's private animals
            // Search ALL animals owned by this user (don't filter by parent ownership)
            const privateOffspring = await Animal.find({
                $or: [
                    { sireId_public: animalIdPublic },
                    { damId_public: animalIdPublic },
                    { fatherId_public: animalIdPublic },
                    { motherId_public: animalIdPublic }
                ],
                ownerId: authenticatedUserId
            }).lean();

            // Map by id_public
            const offspringMap = new Map();
            
            privateOffspring.forEach(animal => {
                offspringMap.set(animal.id_public, animal);
            });

            allOffspring = Array.from(offspringMap.values());
        } else {
            // For unauthenticated users: only get PUBLIC offspring
            allOffspring = await PublicAnimal.find({
                $or: [
                    { sireId_public: animalIdPublic },
                    { damId_public: animalIdPublic },
                    { fatherId_public: animalIdPublic },
                    { motherId_public: animalIdPublic }
                ]
            }).lean();
        }

        // Group offspring by litter (based on birthDate and other parent)
        const litterGroups = new Map();

        for (const offspring of allOffspring) {
            // Determine the other parent ID
            const isSire = offspring.sireId_public === animalIdPublic || offspring.fatherId_public === animalIdPublic;
            const otherParentId = isSire 
                ? (offspring.damId_public || offspring.motherId_public)
                : (offspring.sireId_public || offspring.fatherId_public);
            const otherParentType = isSire ? 'dam' : 'sire';

            // Create a unique key for the litter based on birthDate and other parent
            const birthDate = offspring.birthDate ? new Date(offspring.birthDate).toISOString().split('T')[0] : 'unknown';
            const litterKey = `${birthDate}_${otherParentId || 'none'}`;

            if (!litterGroups.has(litterKey)) {
                litterGroups.set(litterKey, {
                    birthDate: offspring.birthDate,
                    otherParentId: otherParentId,
                    otherParentType: otherParentType,
                    offspring: []
                });
            }

            litterGroups.get(litterKey).offspring.push(offspring);
        }

        // Convert to array and fetch additional data for each litter
        const littersWithOffspring = await Promise.all(
            Array.from(litterGroups.values()).map(async (group) => {
                // Try to find a matching litter record
                let litterRecord = null;
                if (group.birthDate && group.otherParentId) {
                    litterRecord = await Litter.findOne({
                        birthDate: group.birthDate,
                        $or: [
                            { sireId_public: animalIdPublic, damId_public: group.otherParentId },
                            { sireId_public: group.otherParentId, damId_public: animalIdPublic }
                        ]
                    }).lean();
                }

                // Fetch other parent data
                let otherParent = null;
                if (group.otherParentId) {
                    if (isAuthenticated) {
                        // For authenticated users: try private Animal first (their own animals)
                        otherParent = await Animal.findOne({ 
                            id_public: group.otherParentId,
                            ownerId: authenticatedUserId 
                        }).lean();
                        
                        // If not found in private, try PublicAnimal
                        if (!otherParent) {
                            otherParent = await PublicAnimal.findOne({ id_public: group.otherParentId }).lean();
                        }
                    } else {
                        // For unauthenticated users: try PublicAnimal first
                        otherParent = await PublicAnimal.findOne({ id_public: group.otherParentId }).lean();
                        
                        // If not found in PublicAnimal, fetch basic info from private Animal
                        // (We show parent info if there are public offspring, even if parent is private)
                        if (!otherParent) {
                            const privateParent = await Animal.findOne({ id_public: group.otherParentId })
                                .select('id_public name prefix gender imageUrl photoUrl')
                                .lean();
                            if (privateParent) {
                                otherParent = privateParent;
                            }
                        }
                    }
                }

                return {
                    litterId: litterRecord?._id || null,
                    litterName: litterRecord?.breedingPairCodeName || null,
                    birthDate: group.birthDate,
                    sireId_public: group.otherParentType === 'dam' ? animalIdPublic : group.otherParentId,
                    damId_public: group.otherParentType === 'sire' ? animalIdPublic : group.otherParentId,
                    otherParent: otherParent,
                    otherParentType: group.otherParentType,
                    offspring: group.offspring,
                    numberBorn: group.offspring.length
                };
            })
        );

        // Sort by birth date (most recent first)
        littersWithOffspring.sort((a, b) => {
            if (!a.birthDate) return 1;
            if (!b.birthDate) return -1;
            return new Date(b.birthDate) - new Date(a.birthDate);
        });

        // Filter out litters with no offspring (can happen when all offspring are private in public view)
        const filteredLitters = littersWithOffspring.filter(litter => litter.offspring && litter.offspring.length > 0);

        res.status(200).json(filteredLitters);
    } catch (error) {
        console.error('Error fetching offspring:', error);
        res.status(500).json({ message: 'Internal server error while fetching offspring.' });
    }
});

module.exports = router;