const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { addLitter, adoptLitter, getUsersLitters, getLittersForAnimal, updateLitter } = require('../database/db_service');
const { logUserActivity, USER_ACTIONS } = require('../utils/userActivityLogger');
const { Animal, User, Notification, Litter, PublicAnimal } = require('../database/models');
const { syncParentReproStatus } = require('../utils/reproStatusSync');
const r2 = require('../storage/r2_client');
// This router requires authMiddleware to be applied in index.js

// --- Multer setup for litter image uploads ---
const imageFileFilter = (req, file, cb) => {
    if (file.mimetype === 'image/png' || file.mimetype === 'image/jpeg') {
        cb(null, true);
    } else {
        cb(new Error('Only PNG and JPEG images are allowed'), false);
    }
};
const litterUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 500 * 1024 },
    fileFilter: imageFileFilter,
});

// --- Litter Route Controllers (PROTECTED) ---

// POST /api/litters
// 1. Registers a new litter under the logged-in user.
router.post('/', async (req, res) => {
    try {
        // req.user is added by authMiddleware and contains the user's backend _id
        const appUserId_backend = req.user.id; 
        const litterData = req.body;

        const newLitter = await addLitter(appUserId_backend, litterData);

        // Auto-sync sire/dam reproductive flags (planned/mating/pregnant/nursing) based on litters.
        try {
            await syncParentReproStatus(appUserId_backend, [newLitter.sireId_public, newLitter.damId_public]);
        } catch (reproSyncErr) {
            console.error('Warning: failed to sync parent reproductive status:', reproSyncErr);
        }

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
                lossesCount: newLitter.lossesCount ?? null,
                maleStillbornCount: newLitter.maleStillbornCount ?? null,
                femaleStillbornCount: newLitter.femaleStillbornCount ?? null,
                unknownStillbornCount: newLitter.unknownStillbornCount ?? null,
                maleLossesCount: newLitter.maleLossesCount ?? null,
                femaleLossesCount: newLitter.femaleLossesCount ?? null,
                unknownLossesCount: newLitter.unknownLossesCount ?? null,
            };
            const parentIds = [newLitter.sireId_public, newLitter.damId_public].filter(Boolean);
            if (ctlId && parentIds.length) {
                const breedingRecordUpdate = { $set: {
                    'breedingRecords.$[rec].litterSizeBorn': syncFields.litterSizeBorn,
                    'breedingRecords.$[rec].litterSizeWeaned': syncFields.litterSizeWeaned,
                    'breedingRecords.$[rec].stillbornCount': syncFields.stillbornCount,
                    'breedingRecords.$[rec].lossesCount': syncFields.lossesCount,
                }};
                const arrayFilters = { arrayFilters: [{ 'rec.litterId': ctlId }] };
                await Animal.updateMany(
                    { id_public: { $in: parentIds }, 'breedingRecords.litterId': ctlId },
                    breedingRecordUpdate,
                    arrayFilters
                );
                // Keep PublicAnimal's mirrored breedingRecords in sync too (no-ops for non-public animals).
                await PublicAnimal.updateMany(
                    { id_public: { $in: parentIds }, 'breedingRecords.litterId': ctlId },
                    breedingRecordUpdate,
                    arrayFilters
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

        // Notify owners of sire/dam if they are a different user (fire-and-forget)
        (async () => {
            try {
                const currentUserId = appUserId_backend.toString();
                const creatorLabel = req.user.breederName || req.user.displayName || req.user.username;
                const creatorName = creatorLabel ? `${creatorLabel} (${req.user.id_public})` : req.user.id_public;
                const parentRoles = [
                    { id_public: litterData.sireId_public, role: 'sire' },
                    { id_public: litterData.damId_public, role: 'dam' }
                ];
                for (const { id_public, role } of parentRoles) {
                    if (!id_public) continue;
                    const animal = await Animal.findOne({ id_public }).select('creatorId creatorId_public name species imageUrl photoUrl').lean();
                    if (!animal || !animal.creatorId) continue;
                    if (animal.creatorId.toString() === currentUserId) continue; // it's the creator's own animal
                    const ownerUser = await User.findById(animal.creatorId).select('_id id_public').lean();
                    if (!ownerUser) continue;
                    await Notification.create({
                        userId: ownerUser._id,
                        userId_public: ownerUser.id_public,
                        type: 'litter_assignment',
                        status: 'pending',
                        read: false,
                        requestedBy_id: appUserId_backend,
                        requestedBy_public: req.user.id_public,
                        requestedBy_name: creatorName,
                        animalId_public: id_public,
                        animalName: animal.name,
                        animalImageUrl: animal.imageUrl || animal.photoUrl || '',
                        parentType: role,
                        message: `Your ${role === 'sire' ? 'male' : 'female'} "${animal.name}" (${id_public}) was assigned as a ${role} in a new litter (${newLitter.litter_id_public}) created by ${creatorName}.`,
                        metadata: {
                            litterId_public: newLitter.litter_id_public,
                            role,
                            creatorId_public: req.user.id_public,
                            creatorName,
                        }
                    });
                }
            } catch (notifErr) {
                console.error('Warning: failed to send litter assignment notifications:', notifErr);
            }
        })();
    } catch (error) {
        if (error.code === 'DUPLICATE_LITTER') {
            return res.status(409).json({ message: error.message, duplicate: error.duplicate });
        }
        console.error('Error registering litter:', error);
        res.status(500).json({ message: 'Internal server error during litter registration.' });
    }
});


// POST /api/litters/:litterId_backend/adopt
// Links an existing litter (created by another user for the same pairing) into the requesting
// user's own Litter Management instead of creating a duplicate record. Full edit rights are
// granted alongside the original creator; only the creator can delete the litter.
router.post('/:litterId_backend/adopt', async (req, res) => {
    try {
        const appUserId_backend = req.user.id;
        const litter = await adoptLitter(appUserId_backend, req.params.litterId_backend);
        res.status(200).json({ message: 'Litter adopted into your Litter Management!', litter });
    } catch (error) {
        console.error('Error adopting litter:', error);
        if (error.message.includes('not found')) {
            return res.status(404).json({ message: error.message });
        }
        res.status(500).json({ message: 'Internal server error while adopting litter.' });
    }
});


// GET /api/litters/for-animal/:id_public
// Returns litters (registered by ANY user) that reference this animal as sire or dam —
// lets an owner see planned matings/litters other users created using their animal.
// Non-owners only see litters the litter's own creator has marked isDisplayLitter (public),
// so a private litter management record never leaks to anyone besides its owner.
router.get('/for-animal/:id_public', async (req, res) => {
    try {
        const appUserId_backend = req.user.id;
        const { id_public } = req.params;

        const animal = await Animal.findOne({ id_public }).select('creatorId').lean();
        if (!animal) {
            return res.status(404).json({ message: 'Animal not found.' });
        }
        const isOwner = animal.creatorId && animal.creatorId.toString() === appUserId_backend.toString();

        let litters = await getLittersForAnimal(id_public);
        if (!isOwner) {
            litters = litters.filter(l => l.isDisplayLitter === true);
        }
        res.status(200).json(litters);
    } catch (error) {
        console.error('Error fetching litters for animal:', error);
        res.status(500).json({ message: 'Internal server error while fetching litters for animal.' });
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
        const ids = litter.offspringIds_public || [];
        if (!ids.length) return res.status(200).json([]);
        const animals = await Animal.find(
            { id_public: { $in: ids } }
        ).lean();
        // Preserve the order animals were added to the litter (offspringIds_public order)
        const idIndex = new Map(ids.map((id, i) => [id, i]));
        animals.sort((a, b) => (idIndex.get(a.id_public) ?? Infinity) - (idIndex.get(b.id_public) ?? Infinity));
        // Inject litter's parent IDs as fallback for any offspring whose DB links were wiped
        const litterSireId = litter.sireId_public || null;
        const litterDamId = litter.damId_public || null;
        const enriched = animals.map(a => ({
            ...a,
            sireId_public: a.sireId_public || litterSireId,
            damId_public: a.damId_public || litterDamId,
        }));
        res.status(200).json(enriched);
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

        const priorLitter = await Litter.findOne({ _id: litterId_backend, $or: [{ creatorId: appUserId_backend }, { linkedOwners: appUserId_backend }] })
            .select('sireId_public damId_public')
            .lean();

        const updatedLitter = await updateLitter(appUserId_backend, litterId_backend, updates);

        // Recompute reproductive flags for both old and new parents (covers parent changes/removals,
        // as well as birthDate/weaningDate/pregnancyDate transitions edited via any UI).
        try {
            await syncParentReproStatus(appUserId_backend, [
                priorLitter?.sireId_public,
                priorLitter?.damId_public,
                updatedLitter?.sireId_public,
                updatedLitter?.damId_public,
            ]);
        } catch (reproSyncErr) {
            console.error('Warning: failed to sync parent reproductive status on litter update:', reproSyncErr);
        }

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
                lossesCount: updatedLitter.lossesCount ?? null,
            };
            const parentIds = [updatedLitter.sireId_public, updatedLitter.damId_public].filter(Boolean);
            if (ctlId && parentIds.length) {
                const breedingRecordUpdate = { $set: {
                    'breedingRecords.$[rec].litterSizeBorn': syncFields.litterSizeBorn,
                    'breedingRecords.$[rec].litterSizeWeaned': syncFields.litterSizeWeaned,
                    'breedingRecords.$[rec].stillbornCount': syncFields.stillbornCount,
                    'breedingRecords.$[rec].lossesCount': syncFields.lossesCount,
                }};
                const arrayFilters = { arrayFilters: [{ 'rec.litterId': ctlId }] };
                await Animal.updateMany(
                    { id_public: { $in: parentIds }, 'breedingRecords.litterId': ctlId },
                    breedingRecordUpdate,
                    arrayFilters
                );
                // Keep PublicAnimal's mirrored breedingRecords in sync too (no-ops for non-public animals).
                await PublicAnimal.updateMany(
                    { id_public: { $in: parentIds }, 'breedingRecords.litterId': ctlId },
                    breedingRecordUpdate,
                    arrayFilters
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
        
        const litter = await Litter.findOne({ _id: litterId_backend, creatorId: appUserId_backend });
        
        if (!litter) {
            return res.status(404).json({ message: 'Litter not found or does not belong to user.' });
        }

        await Litter.deleteOne({ _id: litterId_backend });

        // Recompute reproductive flags for the (former) sire and dam.
        try {
            await syncParentReproStatus(appUserId_backend, [litter.sireId_public, litter.damId_public]);
        } catch (reproSyncErr) {
            console.error('Warning: failed to sync parent reproductive status on litter delete:', reproSyncErr);
        }

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


// POST /api/litters/:id_backend/images
// Upload one image to a born litter (max 5). Only works on non-planned litters.
router.post('/:id_backend/images', litterUpload.single('image'), async (req, res) => {
    try {
        const litter = await Litter.findById(req.params.id_backend);
        if (!litter) return res.status(404).json({ message: 'Litter not found' });
        if (String(litter.creatorId) !== String(req.user.id) && !litter.linkedOwners.some(id => String(id) === String(req.user.id))) {
            return res.status(403).json({ message: 'Not your litter' });
        }
        if (litter.isPlanned) {
            return res.status(400).json({ message: 'Images can only be added to born litters' });
        }
        if ((litter.images || []).length >= 5) {
            return res.status(400).json({ message: 'Maximum of 5 images per litter' });
        }
        if (!req.file) return res.status(400).json({ message: 'No image file provided' });

        const ext = req.file.mimetype === 'image/png' ? '.png' : '.jpg';
        const key = `litters/${litter._id}/${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;

        const imageUrl = await r2.uploadBuffer(key, req.file.buffer, req.file.mimetype);

        litter.images.push({ url: imageUrl, r2Key: key });
        await litter.save();

        res.json({ url: imageUrl, r2Key: key, images: litter.images });
    } catch (err) {
        console.error('Error uploading litter image:', err);
        res.status(500).json({ message: 'Failed to upload image' });
    }
});

// DELETE /api/litters/:id_backend/images/:r2Key
// Remove one image from a litter by its R2 key (URL-encoded).
router.delete('/:id_backend/images/:r2Key', async (req, res) => {
    try {
        const litter = await Litter.findById(req.params.id_backend);
        if (!litter) return res.status(404).json({ message: 'Litter not found' });
        if (String(litter.creatorId) !== String(req.user.id) && !litter.linkedOwners.some(id => String(id) === String(req.user.id))) {
            return res.status(403).json({ message: 'Not your litter' });
        }

        const r2Key = decodeURIComponent(req.params.r2Key);
        const before = litter.images.length;
        litter.images = litter.images.filter(img => img.r2Key !== r2Key);
        if (litter.images.length === before) {
            return res.status(404).json({ message: 'Image not found' });
        }
        await litter.save();
        res.json({ message: 'Image removed', images: litter.images });
    } catch (err) {
        console.error('Error deleting litter image:', err);
        res.status(500).json({ message: 'Failed to delete image' });
    }
});

module.exports = router;