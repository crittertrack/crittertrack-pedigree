const express = require('express');
const router = express.Router();
const { Enclosure, Animal } = require('../database/models');

// GET all enclosures for the authenticated user
router.get('/', async (req, res) => {
    try {
        const enclosures = await Enclosure.find({ creatorId: req.user.id }).sort({ name: 1 }).lean();
        res.json(enclosures);
    } catch (err) {
        console.error('[GET /api/enclosures]', err);
        res.status(500).json({ message: 'Failed to fetch enclosures' });
    }
});

// POST create enclosure
router.post('/', async (req, res) => {
    try {
        const { name, enclosureType, size, notes, cleaningTasks, dimensions } = req.body;
        if (!name?.trim()) return res.status(400).json({ message: 'Enclosure name is required' });
        const enc = new Enclosure({
            creatorId: req.user.id,
            name: name.trim(),
            enclosureType: enclosureType?.trim() || '',
            size: size?.trim() || '',
            notes: notes?.trim() || '',
            cleaningTasks: Array.isArray(cleaningTasks) ? cleaningTasks : [],
            dimensions: dimensions || { length: '', width: '', height: '', unit: 'cm' }
        });
        await enc.save();
        res.status(201).json(enc);
    } catch (err) {
        console.error('[POST /api/enclosures]', err);
        res.status(500).json({ message: 'Failed to create enclosure' });
    }
});

// PUT update enclosure
router.put('/:id', async (req, res) => {
    try {
        const { name, enclosureType, size, notes, cleaningTasks, dimensions } = req.body;
        if (!name?.trim()) return res.status(400).json({ message: 'Enclosure name is required' });
        const setData = {
            name: name.trim(),
            enclosureType: enclosureType?.trim() || '',
            size: size?.trim() || '',
            notes: notes?.trim() || '',
        };
        if (Array.isArray(cleaningTasks)) setData.cleaningTasks = cleaningTasks;
        if (dimensions) setData.dimensions = dimensions;
        const enc = await Enclosure.findOneAndUpdate(
            { _id: req.params.id, creatorId: req.user.id },
            { $set: setData },
            { new: true }
        );
        if (!enc) return res.status(404).json({ message: 'Enclosure not found' });
        res.json(enc);
    } catch (err) {
        console.error('[PUT /api/enclosures/:id]', err);
        res.status(500).json({ message: 'Failed to update enclosure' });
    }
});

// PATCH assign (or unassign) a single animal to an enclosure
// Body: { animalId_public: 'CTC123', enclosureId: '<id>' | null }
router.patch('/assign-animal', async (req, res) => {
    try {
        const { animalId_public, enclosureId } = req.body;
        if (!animalId_public) return res.status(400).json({ message: 'animalId_public is required' });
        // If assigning, verify the enclosure belongs to this user
        if (enclosureId) {
            const enc = await Enclosure.findOne({ _id: enclosureId, creatorId: req.user.id }).select('_id').lean();
            if (!enc) return res.status(404).json({ message: 'Enclosure not found' });
        }
        const animal = await Animal.findOne({ id_public: animalId_public, creatorId: req.user.id }).select('_id status').lean();
        if (!animal) return res.status(404).json({ message: 'Animal not found' });

        if (animal.status === 'Deceased' || animal.status === 'Rehomed') {
            return res.status(400).json({ message: `Cannot assign ${animal.status.toLowerCase()} animals to an enclosure` });
        }

        const result = await Animal.findOneAndUpdate(
            { _id: animal._id },
            { $set: { enclosureId: enclosureId || null } },
            { new: true }
        );
        if (!result) return res.status(404).json({ message: 'Animal not found' });
        res.json({ ok: true, enclosureId: result.enclosureId });
    } catch (err) {
        console.error('[PATCH /api/enclosures/assign-animal]', err);
        res.status(500).json({ message: 'Failed to assign animal to enclosure' });
    }
});

// DELETE enclosure — also clears enclosureId from all assigned animals
router.delete('/:id', async (req, res) => {
    try {
        const enc = await Enclosure.findOneAndDelete({ _id: req.params.id, creatorId: req.user.id });
        if (!enc) return res.status(404).json({ message: 'Enclosure not found' });
        // Unassign all animals from this enclosure
        await Animal.updateMany(
            { creatorId: req.user.id, enclosureId: req.params.id },
            { $set: { enclosureId: null } }
        );
        res.json({ message: 'Enclosure deleted' });
    } catch (err) {
        console.error('[DELETE /api/enclosures/:id]', err);
        res.status(500).json({ message: 'Failed to delete enclosure' });
    }
});

module.exports = router;
