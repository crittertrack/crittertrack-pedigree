const express = require('express');
const router = express.Router();
const { WaitlistEntry, Animal } = require('../database/models');

const VALID_GENDERS = ['Male', 'Female', 'Any'];

// Normalise one species request into { species, genderCounts, genders, amount }.
// Accepts the new `genderCounts` shape or the legacy `genders` + total `amount`.
function normalizeSpeciesRequest(r) {
    const species = r.species.trim();
    let genderCounts = [];
    if (Array.isArray(r.genderCounts)) {
        genderCounts = r.genderCounts
            .filter(c => VALID_GENDERS.includes(c?.gender) && Number(c.count) > 0)
            .map(c => ({ gender: c.gender, count: Math.floor(Number(c.count)) }));
    }
    if (genderCounts.length === 0) {
        const total = r.amount !== '' && r.amount != null && Number(r.amount) > 0 ? Math.floor(Number(r.amount)) : 1;
        const g = (Array.isArray(r.genders) ? r.genders : []).filter(x => VALID_GENDERS.includes(x));
        genderCounts = g.length === 1 && g[0] !== 'Any'
            ? [{ gender: g[0], count: total }]
            : [{ gender: 'Any', count: total }];
    }
    return {
        species,
        genderCounts,
        genders: genderCounts.map(c => c.gender),
        amount: genderCounts.reduce((s, c) => s + c.count, 0),
    };
}

// GET /api/waitlist — list all entries owned by the current user (newest first)
router.get('/', async (req, res) => {
    try {
        const entries = await WaitlistEntry.find({ userId: req.user.id }).sort({ createdAt: -1 });
        res.json(entries);
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch waitlist', error: err.message });
    }
});

// POST /api/waitlist — create a new waitlist entry (multi-species)
router.post('/', async (req, res) => {
    try {
        const { name, contactInfo, speciesRequests, species, genders, amount, notes } = req.body;
        if (!name?.trim()) return res.status(400).json({ message: 'Name is required' });

        // Normalize speciesRequests: array of { species, genders, amount }
        let requests = speciesRequests;
        if (!Array.isArray(requests) || requests.length === 0) {
            // Backward compat: build a single request from legacy fields
            if (!species?.trim()) return res.status(400).json({ message: 'At least one species is required' });
            requests = [{
                species: species.trim(),
                genders: Array.isArray(genders) ? genders : [],
                amount: amount !== '' && amount != null ? Number(amount) : 1,
            }];
        }
        requests = requests.filter(r => r.species?.trim());
        if (requests.length === 0) return res.status(400).json({ message: 'At least one species is required' });
        const normalized = requests.map(normalizeSpeciesRequest);

        const entry = new WaitlistEntry({
            userId: req.user.id,
            name: name.trim(),
            contactInfo: contactInfo || '',
            speciesRequests: normalized,
            // Mirror canonical request into legacy fields for quick lookup.
            species: normalized[0]?.species || '',
            genders: normalized[0]?.genders || [],
            amount: normalized[0]?.amount ?? 1,
            notes: notes || '',
        });
        await entry.save();
        res.status(201).json(entry);
    } catch (err) {
        res.status(500).json({ message: 'Failed to create waitlist entry', error: err.message });
    }
});

// PATCH /api/waitlist/:id — update a waitlist entry (multi-species)
router.patch('/:id', async (req, res) => {
    try {
        const entry = await WaitlistEntry.findOne({ _id: req.params.id, userId: req.user.id });
        if (!entry) return res.status(404).json({ message: 'Waitlist entry not found' });
        const { name, contactInfo, speciesRequests, species, genders, amount, notes, isActive } = req.body;
        if (name !== undefined) entry.name = name.trim();
        if (contactInfo !== undefined) entry.contactInfo = contactInfo;
        if (Array.isArray(speciesRequests)) {
            entry.speciesRequests = speciesRequests.filter(r => r.species?.trim()).map(normalizeSpeciesRequest);
            const first = entry.speciesRequests[0];
            if (first) { entry.species = first.species; entry.genders = first.genders; entry.amount = first.amount; }
        } else {
            if (species !== undefined) entry.species = species;
            if (genders !== undefined) entry.genders = Array.isArray(genders) ? genders : [];
            if (amount !== undefined) entry.amount = amount !== '' && amount != null ? Number(amount) : 1;
        }
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
        }).select('id_public name species gender').lean();
        entry.assignedAnimals = assigned.map(a => ({
            id_public: a.id_public,
            name: a.name,
            species: a.species,
            gender: a.gender,
            assignedAt: new Date(),
        }));
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
