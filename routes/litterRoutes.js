const express = require('express');
const router = express.Router();
const { addLitter, getUsersLitters, updateLitter } = require('../database/db_service');
const { logUserActivity, USER_ACTIONS } = require('../utils/userActivityLogger');
const { Animal } = require('../database/models');
// This router requires authMiddleware to be applied in index.js

// --- Litter Route Controllers (PROTECTED) ---

// POST /api/litters
// 1. Registers a new litter under the logged-in user.
router.post('/', async (req, res) => {
    try {
        // req.user is added by authMiddleware and contains the user's backend _id
        const appUserId_backend = req.user.id; 
        const litterData = req.body;

        const newLitter = await addLitter(appUserId_backend, litterData);

        // Log user activity
        logUserActivity({
            userId: appUserId_backend,
            id_public: req.user.id_public,
            action: USER_ACTIONS.LITTER_CREATE,
            targetType: 'litter',
            targetId: newLitter._id,
            details: { birthDate: litterData.birthDate, numberBorn: litterData.numberBorn },
            ipAddress: req.ip,
            userAgent: req.get('User-Agent')
        });

        // Sync count fields to any breeding records already referencing this CTL ID
        try {
            const ctlId = newLitter.litter_id_public;
            const syncFields = {
                litterSizeBorn: newLitter.litterSizeBorn ?? newLitter.numberBorn ?? null,
                litterSizeWeaned: newLitter.litterSizeWeaned ?? null,
                stillbornCount: newLitter.stillbornCount ?? null,
            };
            const parentIds = [newLitter.sireId_public, newLitter.damId_public].filter(Boolean);
            if (ctlId && parentIds.length) {
                await Animal.updateMany(
                    { id_public: { $in: parentIds }, 'breedingRecords.litterId': ctlId },
                    { $set: {
                        'breedingRecords.$[rec].litterSizeBorn': syncFields.litterSizeBorn,
                        'breedingRecords.$[rec].litterSizeWeaned': syncFields.litterSizeWeaned,
                        'breedingRecords.$[rec].stillbornCount': syncFields.stillbornCount,
                    }},
                    { arrayFilters: [{ 'rec.litterId': ctlId }] }
                );
            }
        } catch (syncErr) {
            console.error('Warning: failed to sync new litter counts to breeding records:', syncErr);
        }

        res.status(201).json({
            message: 'Litter registered successfully!',
            litterId_backend: newLitter._id,
            litter_id_public: newLitter.litter_id_public
        });
    } catch (error) {
        console.error('Error registering litter:', error);
        res.status(500).json({ message: 'Internal server error during litter registration.' });
    }
});


// GET /api/litters/:id_public/offspring
// Returns all offspring animals for a litter with display-safe fields.
// Private animals (isDisplay: false) are included with isPrivate: true flag.
router.get('/:id_public/offspring', async (req, res) => {
    try {
        const { Litter, Animal } = require('../database/models');
        const litter = await Litter.findOne({ litter_id_public: req.params.id_public }).lean();
        if (!litter) return res.status(404).json({ message: 'Litter not found.' });
        if (!litter.offspringIds_public?.length) return res.status(200).json([]);
        const animals = await Animal.find(
            { id_public: { $in: litter.offspringIds_public } },
            { id_public: 1, name: 1, prefix: 1, suffix: 1, gender: 1, birthDate: 1, species: 1, imageUrl: 1, photoUrl: 1, status: 1, isDisplay: 1 }
        ).lean();
        const result = litter.offspringIds_public.map(id => {
            const a = animals.find(x => x.id_public === id);
            if (!a) return { id_public: id, isPrivate: true, notFound: true };
            return { ...a, isPrivate: !a.isDisplay };
        });
        res.status(200).json(result);
    } catch (error) {
        console.error('Error fetching litter offspring:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
});

// GET /api/litters/:id_public
// Gets a single litter by its public ID (any authenticated user can fetch).
router.get('/:id_public', async (req, res) => {
    try {
        const { Litter } = require('../database/models');
        const litter = await Litter.findOne({ litter_id_public: req.params.id_public });
        if (!litter) return res.status(404).json({ message: 'Litter not found.' });
        res.status(200).json(litter);
    } catch (error) {
        console.error('Error fetching litter by id_public:', error);
        res.status(500).json({ message: 'Internal server error while fetching litter.' });
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


// PUT /api/litters/:id_backend
// 3. Updates an existing litter's record.
router.put('/:id_backend', async (req, res) => {
    try {
        const appUserId_backend = req.user.id;
        const litterId_backend = req.params.id_backend;
        const updates = req.body; // Updates object

        const updatedLitter = await updateLitter(appUserId_backend, litterId_backend, updates);

        // Log user activity
        logUserActivity({
            userId: appUserId_backend,
            id_public: req.user.id_public,
            action: USER_ACTIONS.LITTER_UPDATE,
            targetType: 'litter',
            targetId: litterId_backend,
            details: { fieldsUpdated: Object.keys(updates) },
            ipAddress: req.ip,
            userAgent: req.get('User-Agent')
        });

        // Sync count fields back to breeding records on sire and dam
        try {
            const ctlId = updatedLitter.litter_id_public;
            const syncFields = {
                litterSizeBorn: updatedLitter.litterSizeBorn ?? updatedLitter.numberBorn ?? null,
                litterSizeWeaned: updatedLitter.litterSizeWeaned ?? null,
                stillbornCount: updatedLitter.stillbornCount ?? null,
            };
            const parentIds = [updatedLitter.sireId_public, updatedLitter.damId_public].filter(Boolean);
            if (ctlId && parentIds.length) {
                await Animal.updateMany(
                    { id_public: { $in: parentIds }, 'breedingRecords.litterId': ctlId },
                    { $set: {
                        'breedingRecords.$[rec].litterSizeBorn': syncFields.litterSizeBorn,
                        'breedingRecords.$[rec].litterSizeWeaned': syncFields.litterSizeWeaned,
                        'breedingRecords.$[rec].stillbornCount': syncFields.stillbornCount,
                    }},
                    { arrayFilters: [{ 'rec.litterId': ctlId }] }
                );
            }
        } catch (syncErr) {
            console.error('Warning: failed to sync litter counts to breeding records:', syncErr);
        }

        res.status(200).json({
            message: 'Litter updated successfully!',
            litter: updatedLitter
        });
    } catch (error) {
        console.error('Error updating litter:', error);
        // Use 404 if the litter isn't found or doesn't belong to the user
        if (error.message.includes("not found") || error.message.includes("does not own")) {
            return res.status(404).json({ message: error.message });
        }
        res.status(500).json({ message: 'Internal server error during litter update.' });
    }
});

// DELETE /api/litters/:id_backend
// 4. Deletes a litter record.
router.delete('/:id_backend', async (req, res) => {
    try {
        const appUserId_backend = req.user.id;
        const litterId_backend = req.params.id_backend;

        const { Litter } = require('../database/models');
        
        const litter = await Litter.findOne({ _id: litterId_backend, ownerId: appUserId_backend });
        
        if (!litter) {
            return res.status(404).json({ message: 'Litter not found or does not belong to user.' });
        }

        await Litter.deleteOne({ _id: litterId_backend });

        // Log user activity
        logUserActivity({
            userId: appUserId_backend,
            id_public: req.user.id_public,
            action: USER_ACTIONS.LITTER_DELETE,
            targetType: 'litter',
            targetId: litterId_backend,
            ipAddress: req.ip,
            userAgent: req.get('User-Agent')
        });

        res.status(200).json({ message: 'Litter deleted successfully!' });
    } catch (error) {
        console.error('Error deleting litter:', error);
        res.status(500).json({ message: 'Internal server error during litter deletion.' });
    }
});


module.exports = router;