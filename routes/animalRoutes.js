﻿const express = require('express');
const router = express.Router();
const { Animal, AnimalLog, SupplyItem, Litter, User, PublicAnimal, Transaction, Notification } = require('../database/models');
const { addAnimal, updateAnimal, deleteAnimal, getUsersAnimals, getAnimalByIdAndUser, getArchivedAndSoldAnimals, getAvkReferencePopulation } = require('../database/db_service');
const { calculateInbreedingCoefficient, calculateInbreedingCoefficientWithDiagnostics, calculatePairingInbreeding, explainPairingInbreeding, calculateAverageKinship } = require('../utils/inbreeding');
const { logFeedingEvent } = require('../utils/animalLogger');
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

// ─── Duplicate detection helpers (Find Duplicates feature) ──────────────────
// Levenshtein-distance-based similarity, 0 (no match) to 1 (identical).
function nameSimilarity(a, b) {
    if (!a || !b) return 0;
    const s1 = a.toLowerCase().trim();
    const s2 = b.toLowerCase().trim();
    if (s1 === s2) return 1;
    const len1 = s1.length, len2 = s2.length;
    if (!len1 || !len2) return 0;
    const dp = Array.from({ length: len1 + 1 }, () => new Array(len2 + 1).fill(0));
    for (let i = 0; i <= len1; i++) dp[i][0] = i;
    for (let j = 0; j <= len2; j++) dp[0][j] = j;
    for (let i = 1; i <= len1; i++) {
        for (let j = 1; j <= len2; j++) {
            dp[i][j] = s1[i - 1] === s2[j - 1]
                ? dp[i - 1][j - 1]
                : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
        }
    }
    return 1 - dp[len1][len2] / Math.max(len1, len2);
}

function sameCalendarDay(d1, d2) {
    if (!d1 || !d2) return false;
    const a = new Date(d1), b = new Date(d2);
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function computeDuplicateReasons(a, b) {
    if (a.species !== b.species) return [];
    const reasons = [];
    const sim = nameSimilarity(a.name, b.name);
    if (sim === 1) reasons.push('exact_name');
    else if (sim >= 0.82) reasons.push(`similar_name_${Math.round(sim * 100)}`);
    if (a.birthDate && b.birthDate && sameCalendarDay(a.birthDate, b.birthDate)) reasons.push('same_birthdate_species');
    if (a.sireId_public && b.sireId_public && a.sireId_public === b.sireId_public &&
        a.damId_public && b.damId_public && a.damId_public === b.damId_public) reasons.push('same_parents');
    return reasons;
}

const toDuplicateSummary = (a) => ({
    id_public: a.id_public,
    name: a.name,
    prefix: a.prefix,
    suffix: a.suffix,
    species: a.species,
    gender: a.gender,
    breederAssignedId: a.breederAssignedId,
    imageUrl: a.imageUrl,
    photoUrl: a.photoUrl,
    birthDate: a.birthDate,
    sireId_public: a.sireId_public,
    damId_public: a.damId_public,
    status: a.status
});

// GET /api/animals/duplicates - Find potential duplicate animals within the user's own collection.
// Registered ahead of /:id_public so 'duplicates' is never mistaken for an animal ID.
router.get('/duplicates', async (req, res) => {
    try {
        const userDoc = await User.findById(req.user.id).select('dismissedDuplicatePairs').lean();
        const dismissed = new Set(userDoc?.dismissedDuplicatePairs || []);
        const isDismissed = (id1, id2) => dismissed.has([id1, id2].sort().join('|'));

        const animals = await Animal.find({ creatorId: req.user.id, archived: { $ne: true } })
            .select('id_public name prefix suffix species gender breederAssignedId imageUrl photoUrl birthDate sireId_public damId_public status')
            .lean();

        const groups = [];
        const usedAsDuplicate = new Set();
        for (let i = 0; i < animals.length; i++) {
            const a = animals[i];
            if (usedAsDuplicate.has(a.id_public)) continue;
            const duplicates = [];
            for (let j = i + 1; j < animals.length; j++) {
                const b = animals[j];
                if (usedAsDuplicate.has(b.id_public) || isDismissed(a.id_public, b.id_public)) continue;
                const reasons = computeDuplicateReasons(a, b);
                if (reasons.length) {
                    duplicates.push({ animal: toDuplicateSummary(b), reasons });
                    usedAsDuplicate.add(b.id_public);
                }
            }
            if (duplicates.length) {
                groups.push({ primary: toDuplicateSummary(a), duplicates });
            }
        }

        res.json({ groups });
    } catch (error) {
        console.error('[ANIMALS] Error finding duplicates:', error);
        res.status(500).json({ message: 'Failed to find duplicates', error: error.message });
    }
});

// POST /api/animals/duplicates/dismiss - Mark a pair as "not a duplicate" so it stops showing up.
router.post('/duplicates/dismiss', async (req, res) => {
    try {
        const { id1, id2 } = req.body;
        if (!id1 || !id2) {
            return res.status(400).json({ message: 'Both id1 and id2 are required' });
        }
        const key = [id1, id2].sort().join('|');
        await User.findByIdAndUpdate(req.user.id, { $addToSet: { dismissedDuplicatePairs: key } });
        res.json({ message: 'Dismissed' });
    } catch (error) {
        console.error('[ANIMALS] Error dismissing duplicate:', error);
        res.status(500).json({ message: 'Failed to dismiss duplicate', error: error.message });
    }
});

// POST /api/animals/duplicates/merge - Merge two duplicates: keep one, re-point every record that
// referenced the other (offspring links, litters, logs, transactions) at the kept animal, then delete it.
router.post('/duplicates/merge', async (req, res) => {
    try {
        const { keepId, deleteId } = req.body;
        if (!keepId || !deleteId || keepId === deleteId) {
            return res.status(400).json({ message: 'Both keepId and deleteId are required and must differ' });
        }

        const [keepAnimal, deleteAnimalDoc] = await Promise.all([
            Animal.findOne({ id_public: keepId, creatorId: req.user.id }),
            Animal.findOne({ id_public: deleteId, creatorId: req.user.id })
        ]);

        if (!keepAnimal || !deleteAnimalDoc) {
            return res.status(404).json({ message: 'Could not find one or both animals, or you do not own them.' });
        }

        // Re-point anything that referenced the duplicate at the kept animal instead.
        await Promise.all([
            Animal.updateMany({ sireId_public: deleteId }, { $set: { sireId_public: keepId } }),
            Animal.updateMany({ damId_public: deleteId }, { $set: { damId_public: keepId } }),
            Litter.updateMany({ sireId_public: deleteId }, { $set: { sireId_public: keepId } }),
            Litter.updateMany({ damId_public: deleteId }, { $set: { damId_public: keepId } }),
            PublicAnimal.updateMany({ sireId_public: deleteId }, { $set: { sireId_public: keepId } }),
            PublicAnimal.updateMany({ damId_public: deleteId }, { $set: { damId_public: keepId } }),
            AnimalLog.updateMany({ animalId_public: deleteId }, { $set: { animalId_public: keepId, animalId: keepAnimal._id } }),
            Transaction.updateMany({ animalId: deleteId }, { $set: { animalId: keepId } }),
            Notification.updateMany({ animalId_public: deleteId }, { $set: { animalId_public: keepId } }),
            Notification.updateMany({ targetAnimalId_public: deleteId }, { $set: { targetAnimalId_public: keepId } })
        ]);
        // Litter offspring lists hold an array of IDs — add the keeper before pulling the
        // duplicate out, since Mongo disallows $addToSet and $pull on the same path at once.
        await Litter.updateMany({ offspringIds_public: deleteId }, { $addToSet: { offspringIds_public: keepId } });
        await Litter.updateMany({ offspringIds_public: deleteId }, { $pull: { offspringIds_public: deleteId } });

        // Remove the duplicate animal, its public counterpart, and its ownedAnimals reference.
        await Animal.deleteOne({ _id: deleteAnimalDoc._id });
        await PublicAnimal.deleteOne({ id_public: deleteId });
        await User.findByIdAndUpdate(req.user.id, { $pull: { ownedAnimals: deleteAnimalDoc._id } });

        res.json({ message: `Merged "${deleteAnimalDoc.name}" into "${keepAnimal.name}".` });
    } catch (error) {
        console.error('[ANIMALS] Error merging duplicates:', error);
        res.status(500).json({ message: 'Failed to merge animals', error: error.message });
    }
});

// GET /api/animals/:id_public - Get a single animal by public ID
router.get('/:id_public', async (req, res) => {
    try {
        const { id_public } = req.params;
        const userId = req.user.id;
        
        // First check: user is the owner
        let animal = await Animal.findOne({
            id_public,
            creatorId: userId
        }).lean();

        if (animal) {
            // Ensure isViewOnly is NOT set for owned animals
            if (animal.isViewOnly) {
                delete animal.isViewOnly;
            }
            return res.json(animal);
        }

        // Second check: user has view-only access (transferred to them)
        const viewOnlyAnimal = await Animal.findOne({
            id_public,
            viewOnlyForUsers: userId
        }).lean();

        if (viewOnlyAnimal) {
            // Add isViewOnly flag for frontend context
            viewOnlyAnimal.isViewOnly = true;
            return res.json(viewOnlyAnimal);
        }

        // Not found or no permission
        return res.status(404).json({ message: 'Animal not found or you do not have permission to view it.' });
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
            // Backfill isDisplay from Animal collection (PublicAnimal doesn't store this)
            const privateAnimal = await Animal.findOne({ id_public }).select('isDisplay').lean();
            return res.json({
                ...publicAnimal,
                isDisplay: privateAnimal?.isDisplay ?? false
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
// Pass ?includeManaged=true to also include offspring already tracked by a Litter
// Management record (used by the Family Tree, which needs every known relative).
router.get('/:id_public/offspring', async (req, res) => {
    try {
        const { id_public } = req.params;
        const includeManaged = req.query.includeManaged === 'true';
        const viewerId = req.user.id.toString();

        // Find all offspring where this animal is a parent.
        const offspring = await Animal.find({
            $or: [{ sireId_public: id_public }, { damId_public: id_public }]
        }).lean();

        let relevantOffspring = offspring;
        if (!includeManaged) {
            // Exclude offspring only if they're tracked by a Litter Management record the
            // viewer can actually see (own litters, litters on an animal the viewer owns —
            // even if another user created the litter, or another user's litter marked
            // isDisplayLitter) — that litter is represented by GET /litters/for-animal instead.
            // Offspring whose only litter link is someone else's PRIVATE litter (on an animal
            // the viewer doesn't own) fall through and are shown here instead, so a public
            // offspring is never hidden behind another user's private litter record.
            const { Litter } = require('../database/models');
            const viewedAnimal = await Animal.findOne({ id_public }).select('creatorId').lean();
            const viewerOwnsThisAnimal = !!(viewedAnimal && viewedAnimal.creatorId && viewedAnimal.creatorId.toString() === viewerId);
            const managedLitters = await Litter.find({
                $or: [{ sireId_public: id_public }, { damId_public: id_public }]
            }).select('creatorId isDisplayLitter offspringIds_public').lean();

            const litterVisibility = new Map();
            const visibleOffspringIds = new Set();
            for (const litter of managedLitters) {
                const isVisible = viewerOwnsThisAnimal || (litter.creatorId && litter.creatorId.toString() === viewerId) || litter.isDisplayLitter === true;
                litterVisibility.set(litter._id.toString(), isVisible);
                if (isVisible) {
                    (litter.offspringIds_public || []).forEach(id => visibleOffspringIds.add(id));
                }
            }

            relevantOffspring = offspring.filter(o => {
                const excludedByVisibleLitter = visibleOffspringIds.has(o.id_public)
                    || (o.litterId && litterVisibility.get(o.litterId.toString()) === true);
                if (excludedByVisibleLitter) return false;
                // Only show if the viewer owns this offspring or it's public.
                return (o.creatorId && o.creatorId.toString() === viewerId) || o.isDisplay === true;
            });
        }

        // Group offspring by litter to match frontend expectation
        const litterGroups = new Map();
        for (const o of relevantOffspring) {
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

        // Filter all results to only include displayable animals (based on isDisplay toggle only)
        const publicOnlyFilter = (animal) => animal.isDisplay === true;
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

// POST /api/animals/:id_public/feeding - Mark an animal as fed (or skip a feeding)
router.post('/:id_public/feeding', async (req, res) => {
    try {
        const { id_public } = req.params;
        const userId = req.user.id;
        const { supplyId, quantity, notes, skipped } = req.body;

        const animal = await Animal.findOne({ id_public, creatorId: userId });
        if (!animal) {
            return res.status(404).json({ message: 'Animal not found or you do not have permission to edit it.' });
        }

        animal.lastFedDate = new Date();
        await animal.save();

        let supply = null;
        let foodName = null;
        if (supplyId) {
            supply = await SupplyItem.findOne({ _id: supplyId, userId });
            if (supply) {
                foodName = supply.name;
                if (quantity !== undefined && quantity !== null && quantity !== '') {
                    const qty = Number(quantity) || 0;
                    supply.currentStock = Math.max(0, (supply.currentStock || 0) - qty);
                    await supply.save();
                }
            }
        }

        await logFeedingEvent({
            userId,
            animalId: animal._id,
            animalId_public: animal.id_public,
            foodName,
            quantity,
            notes,
            skipped: !!skipped,
        });

        res.json({ animal, supply });
    } catch (error) {
        console.error(`[ANIMALS] Error logging feeding for ${req.params.id_public}:`, error);
        res.status(500).json({ message: 'Failed to log feeding', error: error.message });
    }
});

// GET /api/animals/:id_public/logs - Get the change log (Logs tab) for an animal
router.get('/:id_public/logs', async (req, res) => {
    try {
        const { id_public } = req.params;
        const userId = req.user.id;

        const animal = await Animal.findOne({
            id_public,
            $or: [{ creatorId: userId }, { viewOnlyForUsers: userId }]
        }).select('_id').lean();

        if (!animal) {
            return res.status(404).json({ message: 'Animal not found or you do not have permission to view its logs.' });
        }

        const logs = await AnimalLog.find({ animalId: animal._id })
            .sort({ createdAt: -1 })
            .limit(500)
            .lean();

        res.json(logs);
    } catch (error) {
        console.error(`[ANIMALS] Error fetching logs for ${req.params.id_public}:`, error);
        res.status(500).json({ message: 'Failed to fetch animal logs', error: error.message });
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

        const result = await calculateInbreedingCoefficientWithDiagnostics(id_public, fetchAnimal, generations);

        // Update the animal's record with the cached value if the user owns it
        await Animal.updateOne({ id_public, creatorId: req.user.id }, { inbreedingCoefficient: result.inbreedingCoefficient });

        // AVK (Average Kinship) — additive alongside COI above; does not alter the COI
        // calculation itself. Reference population is the target animal's own owner's
        // living, non-archived, same-species animals (see getAvkReferencePopulation).
        //
        // Serve the last CACHED value immediately and recompute in the background: a
        // real reference population can be large enough (hundreds of same-species
        // animals) that computing it synchronously here was serializing behind the COI
        // response and made the whole endpoint appear to hang. AVK is eventually
        // consistent — it refreshes on the next fetch after a background recompute
        // finishes, instead of ever blocking this request.
        let avgKinship = null;
        let avkPopulationSize = null;
        try {
            const targetAnimal = await Animal.findOne({ id_public }).select('creatorId species avgKinship avkPopulationSize').lean();
            if (targetAnimal) {
                avgKinship = targetAnimal.avgKinship ?? null;
                avkPopulationSize = targetAnimal.avkPopulationSize ?? null;

                // Fire-and-forget recompute; intentionally not awaited.
                (async () => {
                    try {
                        const populationIds = await getAvkReferencePopulation(targetAnimal.creatorId, targetAnimal.species);
                        const avk = await calculateAverageKinship(id_public, populationIds, fetchAnimal, generations);
                        await Animal.updateOne(
                            { id_public, creatorId: targetAnimal.creatorId },
                            { avgKinship: avk.avgKinship, avkPopulationSize: avk.populationSize }
                        );
                    } catch (bgError) {
                        console.error(`[ANIMALS] Background AVK recompute failed for ${id_public}:`, bgError);
                    }
                })();
            }
        } catch (avkError) {
            console.error(`[ANIMALS] Error reading cached AVK for ${id_public}:`, avkError);
        }

        res.json({ 
            id_public, 
            inbreedingCoefficient: result.inbreedingCoefficient,
            commonAncestorCount: result.commonAncestorCount,
            avgKinship,
            avkPopulationSize
        });
    } catch (error) {
        console.error(`[ANIMALS] Error calculating inbreeding for ${req.params.id_public}:`, error);
        res.status(500).json({ message: 'Failed to calculate inbreeding coefficient', error: error.message });
    }
});
module.exports = router;