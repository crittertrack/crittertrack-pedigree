const express = require('express');
const router = express.Router();
const { AppearanceFieldOption, Animal, PublicAnimal } = require('../database/models');

// GET /api/appearance-options?species=Fancy%20Mouse&field=color
// Returns this user's saved dropdown options for the given species+field, alphabetized.
// If species/field are omitted, returns ALL of this user's saved options (full objects,
// for the Profile Settings management page) instead of the plain value-list shape.
router.get('/', async (req, res) => {
    try {
        const { species, field } = req.query;

        if (!species || !field) {
            const allOptions = await AppearanceFieldOption.find({ userId: req.user.id })
                .select('species field value')
                .collation({ locale: 'en', strength: 2 })
                .sort({ species: 1, field: 1, value: 1 })
                .lean();
            return res.json(allOptions);
        }

        const options = await AppearanceFieldOption.find({ userId: req.user.id, species, field })
            .select('value')
            .collation({ locale: 'en', strength: 2 })
            .sort({ value: 1 })
            .lean();

        res.json(options.map(o => o.value));
    } catch (error) {
        console.error('[appearanceFieldOptions] Error fetching options:', error);
        res.status(500).json({ message: 'Failed to fetch dropdown options.' });
    }
});

// POST /api/appearance-options — add a new value to the user's list for a species+field.
// Idempotent/case-insensitive: silently no-ops if the value already exists.
router.post('/', async (req, res) => {
    try {
        const { species, field, value } = req.body;
        if (!species || !field || !value || !value.trim()) {
            return res.status(400).json({ message: 'species, field, and value are required.' });
        }

        await AppearanceFieldOption.findOneAndUpdate(
            { userId: req.user.id, species, field, value: value.trim() },
            { $setOnInsert: { userId: req.user.id, species, field, value: value.trim() } },
            { upsert: true, collation: { locale: 'en', strength: 2 } }
        );

        res.status(201).json({ message: 'Option saved.' });
    } catch (error) {
        console.error('[appearanceFieldOptions] Error saving option:', error);
        res.status(500).json({ message: 'Failed to save dropdown option.' });
    }
});

// PATCH /api/appearance-options/:id — rename a value (e.g. fixing a typo). Cascades the rename
// to this user's existing animals (and their public mirrors) currently using the old value, so
// the fix doesn't leave old records out of sync with the corrected list.
router.patch('/:id', async (req, res) => {
    try {
        const newValue = req.body.value?.trim();
        if (!newValue) {
            return res.status(400).json({ message: 'value is required.' });
        }

        const option = await AppearanceFieldOption.findOne({ _id: req.params.id, userId: req.user.id });
        if (!option) {
            return res.status(404).json({ message: 'Option not found.' });
        }

        if (option.value.toLowerCase() === newValue.toLowerCase()) {
            option.value = newValue;
            await option.save();
            return res.json(option);
        }

        const duplicate = await AppearanceFieldOption.findOne({
            _id: { $ne: option._id }, userId: req.user.id, species: option.species, field: option.field, value: newValue
        }).collation({ locale: 'en', strength: 2 });
        if (duplicate) {
            return res.status(409).json({ message: `"${newValue}" already exists in this list.` });
        }

        const { species, field } = option;
        const oldValue = option.value;
        option.value = newValue;
        await option.save();

        await Animal.updateMany(
            { creatorId: req.user.id, species, [field]: oldValue },
            { $set: { [field]: newValue } }
        );
        await PublicAnimal.updateMany(
            { creatorId_public: req.user.id_public, species, [field]: oldValue },
            { $set: { [field]: newValue } }
        );

        res.json(option);
    } catch (error) {
        console.error('[appearanceFieldOptions] Error renaming option:', error);
        res.status(500).json({ message: 'Failed to rename dropdown option.' });
    }
});

// DELETE /api/appearance-options/:id — remove a user-added option (for future management UI).
router.delete('/:id', async (req, res) => {
    try {
        const result = await AppearanceFieldOption.deleteOne({ _id: req.params.id, userId: req.user.id });
        if (result.deletedCount === 0) {
            return res.status(404).json({ message: 'Option not found.' });
        }
        res.json({ message: 'Option removed.' });
    } catch (error) {
        console.error('[appearanceFieldOptions] Error deleting option:', error);
        res.status(500).json({ message: 'Failed to delete dropdown option.' });
    }
});

module.exports = router;
