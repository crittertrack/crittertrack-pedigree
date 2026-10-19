const express = require('express');
const router = express.Router();
const { WaitlistEntry, Animal } = require('../database/models');

// GET /api/waitlist — list all entries owned by the current user (newest first)
router.get('/', async (req, res) => {
    try {
        const entries = await WaitlistEntry.find({ userId: req.user.id }).sort({ createdAt: -1 });
        res.json(entries);
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch waitlist', error: err.message });
    }
});

// POST /api/waitlist — create a new waitlist entry
router.post('/', async (req, res) => {
    try {
        const { name, contactInfo, species, genders, amount, notes } = req.body;
        if (!name?.trim()) return res.status(400).json({ message: 'Name is required' });
        const entry = new WaitlistEntry({
            userId: req.user.id,
            name: name.trim(),
            contactInfo: contactInfo || '',
            species: species || '',
            genders: Array.isArray(genders) ? genders : [],
            amount: amount !== '' && amount != null ? Number(amount) : 1,
            notes: notes || '',
        });
        await entry.save();
        res.status(201).json(entry);
    } catch (err) {
        res.status(500).json({ message: 'Failed to create waitlist entry', error: err.message });
    }
});

// PATCH /api/waitlist/:id — update a waitlist entry
router.patch('/:id', async (req, res) => {
    try {
        const entry = await WaitlistEntry.findOne({ _id: req.params.id, userId: req.user.id });
        if (!entry) return res.status(404).json({ message: 'Waitlist entry not found' });
        const { name, contactInfo, species, genders, amount, notes, isActive } = req.body;
        if (name !== undefined) entry.name = name.trim();
        if (contactInfo !== undefined) entry.contactInfo = contactInfo;
        if (species !== undefined) entry.species = species;
        if (genders !== undefined) entry.genders = Array.isArray(genders) ? genders : [];
        if (amount !== undefined) entry.amount = amount !== '' && amount != null ? Number(amount) : 1;
        if (notes !== undefined) entry.notes = notes;
        if (isActive !== undefined) entry.isActive = !!isActive;
        await entry.save();
        res.json(entry);
    } catch (err) {
        res.status(500).json({ message: 'Failed to update waitlist entry', error: err.message });
    }
});

// POST /api/waitlist/:id/finalize — move to history, snapshotting animals assigned via the picker
// (animals whose reservedWaitlistEntryId points at this entry)
router.post('/:id/finalize', async (req, res) => {
    try {
        const entry = await WaitlistEntry.findOne({ _id: req.params.id, userId: req.user.id });
        if (!entry) return res.status(404).json({ message: 'Waitlist entry not found' });
        const assigned = await Animal.find({
            creatorId: req.user.id,
            reservedWaitlistEntryId: entry._id,
        }).select('id_public name').lean();
        entry.assignedAnimals = assigned.map(a => ({ id_public: a.id_public, name: a.name, assignedAt: new Date() }));
        entry.isActive = false;
        entry.finalizedAt = new Date();
        await entry.save();
        res.json(entry);
    } catch (err) {
        res.status(500).json({ message: 'Failed to finalize waitlist entry', error: err.message });
    }
});

// DELETE /api/waitlist/:id — delete a waitlist entry
router.delete('/:id', async (req, res) => {
    try {
        const result = await WaitlistEntry.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
        if (!result) return res.status(404).json({ message: 'Waitlist entry not found' });
        res.json({ message: 'Deleted' });
    } catch (err) {
        res.status(500).json({ message: 'Failed to delete waitlist entry', error: err.message });
    }
});

module.exports = router;
