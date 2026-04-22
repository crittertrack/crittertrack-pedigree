const express = require('express');
const router = express.Router();
const { User } = require('../database/models');

// GET /api/collections - fetch user's collections and animal map
router.get('/', async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('animalCollections').lean();
        const data = user?.animalCollections || {};
        res.json({
            collections: Array.isArray(data.collections) ? data.collections : [],
            animalMap: (data.animalMap && typeof data.animalMap === 'object') ? data.animalMap : {}
        });
    } catch (err) {
        console.error('[GET /api/collections]', err);
        res.status(500).json({ message: 'Failed to fetch collections' });
    }
});

// PUT /api/collections - save entire collections state
router.put('/', async (req, res) => {
    try {
        const { collections, animalMap } = req.body;

        if (!Array.isArray(collections)) return res.status(400).json({ message: 'collections must be an array' });
        if (typeof animalMap !== 'object' || Array.isArray(animalMap)) return res.status(400).json({ message: 'animalMap must be an object' });

        // Validate collections: each entry must have id and name strings, max 100 collections
        if (collections.length > 100) return res.status(400).json({ message: 'Maximum 100 collections allowed' });
        for (const col of collections) {
            if (typeof col.id !== 'string' || typeof col.name !== 'string' || !col.name.trim()) {
                return res.status(400).json({ message: 'Invalid collection entry' });
            }
            if (col.name.length > 100) return res.status(400).json({ message: `Collection name too long: ${col.name}` });
        }

        await User.findByIdAndUpdate(req.user.id, {
            $set: { animalCollections: { collections, animalMap } }
        });

        res.json({ ok: true });
    } catch (err) {
        console.error('[PUT /api/collections]', err);
        res.status(500).json({ message: 'Failed to save collections' });
    }
});

module.exports = router;
