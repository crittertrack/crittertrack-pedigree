const express = require('express');
const router = express.Router();
const { ResourceSuggestion } = require('../database/models');

// POST /api/resource-suggestions - logged-in users submit a link for admin review
router.post('/', async (req, res) => {
    try {
        const { text } = req.body;
        if (!text?.trim()) {
            return res.status(400).json({ error: 'Text is required' });
        }

        const suggestion = new ResourceSuggestion({ text: text.trim() });
        await suggestion.save();
        res.status(201).json(suggestion);
    } catch (error) {
        console.error('Error creating resource suggestion:', error);
        res.status(500).json({ error: 'Failed to submit suggestion' });
    }
});

module.exports = router;
