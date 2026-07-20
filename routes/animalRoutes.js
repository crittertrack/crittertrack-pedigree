﻿const express = require('express');
const router = express.Router();
const { Animal } = require('../database/models');
const { addAnimal, updateAnimal, deleteAnimal, getUsersAnimals, getAnimalByIdAndUser, getArchivedAndSoldAnimals } = require('../database/db_service');
const { calculateInbreedingCoefficient, calculatePairingInbreeding, explainPairingInbreeding } = require('../utils/inbreeding');
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

// GET /api/animals/archived - Get archived and sold/transferred animals for the user
router.get('/archived', async (req, res) => {
    try {
        const data = await getArchivedAndSoldAnimals(req.user.id);
        res.json(data);
    } catch (error) {
        console.error('[ANIMALS] Error fetching archived animals:', error);
        res.status(500).json({ message: 'Failed to fetch archived animals', error: error.message });
    }
});

// GET /api/animals/inbreeding/pairing - Calculate COI for a pairing (two animals as parents)
router.get('/inbreeding/pairing', async (req, res) => {
    try {
        const { sireId, damId, generations = 20 } = req.query;
        
        if (!sireId || !damId) {
            return res.status(400).json({ message: 'Both sireId and damId are required' });
        }

        // Verify both animals exist
        const [sire, dam] = await Promise.all([
            Animal.findOne({ id_public: sireId }).lean(),
            Animal.findOne({ id_public: damId }).lean()
        ]);

        if (!sire || !dam) {
            return res.status(404).json({ message: 'One or both animals not found' });
        }

        // Calculate COI with ancestor breakdown
        const fetchAnimal = async (animalId) => {
            return Animal.findOne({ id_public: animalId }).select('sireId_public damId_public name').lean();
        };

        const result = await explainPairingInbreeding(sireId, damId, fetchAnimal, parseInt(generations) || 20);

        res.json({ 
            sireId, 
            damId, 
            inbreedingCoefficient: result.total,
            generations: parseInt(generations) || 20,
            breakdown: result.breakdown
        });
    } catch (error) {
        console.error('[ANIMALS] Error calculating pairing COI:', error);
        res.status(500).json({ message: 'Failed to calculate COI for pairing', error: error.message });
    }
});

// GET /api/animals/:id_public - Get a single animal by public ID
router.get('/:id_public', async (req, res) => {
    try {
        const animal = await Animal.findOne({
            id_public: req.params.id_public,
            creatorId: req.user.id
        }).lean();

        if (!animal) {
            // Check for view-only access if not the owner
            const viewOnlyAnimal = await Animal.findOne({
                id_public: req.params.id_public,
                viewOnlyForUsers: req.user.id
            }).lean();

            if (!viewOnlyAnimal) {
                return res.status(404).json({ message: 'Animal not found or you do not have permission to view it.' });
            }
            // Add isViewOnly flag for frontend context
            viewOnlyAnimal.isViewOnly = true;
            return res.json(viewOnlyAnimal);
        }

        res.json(animal);
    } catch (error) {
        console.error(`[ANIMALS] Error fetching animal ${req.params.id_public}:`, error);
        res.status(500).json({ message: 'Failed to fetch animal', error: error.message });
    }
});

// GET /api/animals/any/:id_public - Get an animal by public ID, checking ownership, view-only, and public status
router.get('/any/:id_public', async (req, res) => {
    try {
        const { id_public } = req.params;
        const userId = req.user.id;

        // 1. Check if the user owns the animal or has view-only access to the full record
        let animal = await Animal.findOne({
            id_public,
            $or: [{ creatorId: userId }, { viewOnlyForUsers: userId }]
        }).lean();

        if (animal) {
            return res.json(animal);
        }

        // 2. If not, check if there's a public version of the animal
        const { PublicAnimal } = require('../database/models');
        const publicAnimal = await PublicAnimal.findOne({ id_public }).lean();

        if (publicAnimal) {
            // Backfill visibility fields from Animal collection (PublicAnimal doesn't store these)
            const privateAnimal = await Animal.findOne({ id_public }).select('showOnPublicProfile isOwned archived').lean();
            return res.json({
                ...publicAnimal,
                showOnPublicProfile: privateAnimal?.showOnPublicProfile ?? true,
                isOwned: privateAnimal?.isOwned ?? true,
                archived: privateAnimal?.archived ?? false
            });
        }

        // 3. As a last resort, check if an animal with this ID exists at all, but return only public-safe fields
        const anyAnimal = await Animal.findOne({ id_public }).select('id_public name prefix suffix species gender imageUrl photoUrl breederId_public sireId_public damId_public').lean();
        if (anyAnimal) {
            return res.json(anyAnimal);
        }

        return res.status(404).json({ message: 'Animal not found.' });
    } catch (error) {
        console.error(`[ANIMALS] Error fetching any animal ${req.params.id_public}:`, error);
        res.status(500).json({ message: 'Failed to fetch animal', error: error.message });
    }
});

// GET /api/animals/:id_public/offspring - Get all offspring for an animal
router.get('/:id_public/offspring', async (req, res) => {
    try {
        const { id_public } = req.params;

        // Find all offspring where this animal is a parent.
        const offspring = await Animal.find({
            $or: [{ sireId_public: id_public }, { damId_public: id_public }]
        }).lean();

        // Group offspring by litter to match frontend expectation
        const litterGroups = new Map();
        for (const o of offspring) {
            const birthDate = o.birthDate ? new Date(o.birthDate).toISOString().split('T')[0] : 'unknown';
            const otherParentId = o.sireId_public === id_public ? o.damId_public : o.sireId_public;
            const litterKey = `${birthDate}_${otherParentId || 'none'}`;

            if (!litterGroups.has(litterKey)) {
                litterGroups.set(litterKey, { birthDate: o.birthDate, otherParentId: otherParentId, offspring: [] });
            }
            litterGroups.get(litterKey).offspring.push(o);
        }

        const littersWithOffspring = Array.from(litterGroups.values()).sort((a, b) => new Date(b.birthDate) - new Date(a.birthDate));
        res.json(littersWithOffspring);
    } catch (error) {
        console.error(`[ANIMALS] Error fetching offspring for ${req.params.id_public}:`, error);
        res.status(500).json({ message: 'Failed to fetch offspring', error: error.message });
    }
});

// GET /api/animals/:id_public/relationships - Get public relatives for an animal
router.get('/:id_public/relationships', async (req, res) => {
    try {
        const { id_public } = req.params;

        const animalMap = new Map();
        const fetchAndCache = async (ids) => {
            const newIds = [...new Set(ids.filter(id => id && !animalMap.has(id)))];
            if (newIds.length === 0) return;
            const animals = await Animal.find({ id_public: { $in: newIds } }).lean();
            animals.forEach(a => animalMap.set(a.id_public, a));
        };

        const subject = await Animal.findOne({ id_public }).lean();
        if (!subject) {
            return res.status(404).json({ message: 'Animal not found.' });
        }
        animalMap.set(id_public, subject);

        const rels = {
            parents: [],
            grandparents: [],
            greatGrandparents: [],
            siblings: [],
            auntsUncles: [],
            cousins: [],
            nephewsNieces: []
        };

        // --- ANCESTORS ---
        const sireId = subject.sireId_public;
        const damId = subject.damId_public;
        await fetchAndCache([sireId, damId]);
        const sire = animalMap.get(sireId);
        const dam = animalMap.get(damId);

        const pgsId = sire?.sireId_public, pgdId = sire?.damId_public;
        const mgsId = dam?.sireId_public, mgdId = dam?.damId_public;
        await fetchAndCache([pgsId, pgdId, mgsId, mgdId]);
        const pgs = animalMap.get(pgsId), pgd = animalMap.get(pgdId);
        const mgs = animalMap.get(mgsId), mgd = animalMap.get(mgdId);

        const ggpIds = [
            pgs?.sireId_public, pgs?.damId_public, pgd?.sireId_public, pgd?.damId_public,
            mgs?.sireId_public, mgs?.damId_public, mgd?.sireId_public, mgd?.damId_public
        ].filter(Boolean);
        await fetchAndCache(ggpIds);

        // Populate ancestors, adding side info
        if (sire) rels.parents.push({ ...sire, _side: 'paternal' });
        if (dam) rels.parents.push({ ...dam, _side: 'maternal' });
        if (pgs) rels.grandparents.push({ ...pgs, _side: 'paternal' });
        if (pgd) rels.grandparents.push({ ...pgd, _side: 'paternal' });
        if (mgs) rels.grandparents.push({ ...mgs, _side: 'maternal' });
        if (mgd) rels.grandparents.push({ ...mgd, _side: 'maternal' });
        ggpIds.forEach(id => {
            const ggp = animalMap.get(id);
            if (ggp) {
                const side = [pgs?.sireId_public, pgs?.damId_public, pgd?.sireId_public, pgd?.damId_public].includes(id) ? 'paternal' : 'maternal';
                rels.greatGrandparents.push({ ...ggp, _side: side });
            }
        });

        // --- COLLATERALS ---
        // Siblings
        if (sireId || damId) {
            const query = { id_public: { $ne: id_public }, $or: [] };
            if (sireId) query.$or.push({ sireId_public: sireId });
            if (damId) query.$or.push({ damId_public: damId });
            if (query.$or.length > 0) {
                rels.siblings = await Animal.find(query).lean();
            }
        }

        // Filter all results to only include public animals (must be public, owned, and not archived)
        const publicOnlyFilter = (animal) => (animal.showOnPublicProfile || animal.isDisplay) && animal.isOwned !== false && animal.archived !== true;
        for (const key in rels) {
            rels[key] = rels[key].filter(publicOnlyFilter);
        }

        res.json(rels);
    } catch (error) {
        console.error(`[ANIMALS] Error fetching relationships for ${req.params.id_public}:`, error);
        res.status(500).json({ message: 'Failed to fetch relationships', error: error.message });
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

// DELETE /api/animals/:id_public - Delete an animal
router.delete('/:id_public', async (req, res) => {
    try {
        const { id_public } = req.params;
        const userId = req.user.id;

        // Find the animal by its public ID to verify ownership and get its internal _id
        const animal = await Animal.findOne({
            id_public: id_public,
            creatorId: userId
        });

        if (!animal) {
            // This matches the behavior of the PUT and GET endpoints.
            return res.status(404).json({ message: 'Animal not found or you do not have permission to delete it.' });
        }

        // Call the service function with the internal _id.
        const result = await deleteAnimal(userId, animal._id);

        res.json(result);
    } catch (error) {
        console.error(`[ANIMALS] Error deleting animal ${req.params.id_public}:`, error);
        res.status(500).json({ message: 'Failed to delete animal', error: error.message });
    }
});

// GET /api/animals/:id_public/inbreeding - Calculate inbreeding coefficient
router.get('/:id_public/inbreeding', async (req, res) => {
    try {
        const { id_public } = req.params;
        const generations = parseInt(req.query.generations) || 50;

        const fetchAnimal = async (animalId) => {
            // In a private context, we can see all animals for pedigree calculation.
            return Animal.findOne({ id_public: animalId }).select('sireId_public damId_public').lean();
        };

        const coefficient = await calculateInbreedingCoefficient(id_public, fetchAnimal, generations);

        // Update the animal's record with the cached value if the user owns it
        await Animal.updateOne({ id_public, creatorId: req.user.id }, { inbreedingCoefficient: coefficient });

        res.json({ id_public, inbreedingCoefficient: coefficient });
    } catch (error) {
        console.error(`[ANIMALS] Error calculating inbreeding for ${req.params.id_public}:`, error);
        res.status(500).json({ message: 'Failed to calculate inbreeding coefficient', error: error.message });
    }
});
module.exports = router;