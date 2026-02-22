const express = require('express');
const router = express.Router();
const { Enclosure, Animal } = require('../database/models');

// GET all enclosures for the authenticated user
router.get('/', async (req, res) => {
    try {
        const enclosures = await Enclosure.find({ ownerId: req.user.id }).sort({ name: 1 }).lean();
        res.json(enclosures);
    } catch (err) {
        console.error('[GET /api/enclosures]', err);
        res.status(500).json({ message: 'Failed to fetch enclosures' });
    }
});

// POST create enclosure
router.post('/', async (req, res) => {
    try {
        const { name, enclosureType, size, notes, cleaningTasks } = req.body;
        if (!name?.trim()) return res.status(400).json({ message: 'Enclosure name is required' });
        const enc = new Enclosure({
            ownerId: req.user.id,
            name: name.trim(),
            enclosureType: enclosureType?.trim() || '',
            size: size?.trim() || '',
            notes: notes?.trim() || '',
            cleaningTasks: Array.isArray(cleaningTasks) ? cleaningTasks : [],
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
        const { name, enclosureType, size, notes, cleaningTasks } = req.body;
        if (!name?.trim()) return res.status(400).json({ message: 'Enclosure name is required' });
        const setData = {
            name: name.trim(),
            enclosureType: enclosureType?.trim() || '',
            size: size?.trim() || '',
            notes: notes?.trim() || '',
        };
        if (Array.isArray(cleaningTasks)) setData.cleaningTasks = cleaningTasks;
        const enc = await Enclosure.findOneAndUpdate(
            { _id: req.params.id, ownerId: req.user.id },
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

// DELETE enclosure — also clears enclosureId from all assigned animals
router.delete('/:id', async (req, res) => {
    try {
        const enc = await Enclosure.findOneAndDelete({ _id: req.params.id, ownerId: req.user.id });
        if (!enc) return res.status(404).json({ message: 'Enclosure not found' });
        // Unassign all animals from this enclosure
        await Animal.updateMany(
            { ownerId: req.user.id, enclosureId: req.params.id },
            { $set: { enclosureId: null } }
        );
        res.json({ message: 'Enclosure deleted' });
    } catch (err) {
        console.error('[DELETE /api/enclosures/:id]', err);
        res.status(500).json({ message: 'Failed to delete enclosure' });
    }
});

module.exports = router;
