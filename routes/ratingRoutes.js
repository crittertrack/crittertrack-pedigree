const express = require('express');
const router = express.Router();
const { BreederRating, PublicProfile, User } = require('../database/models');

// POST /api/ratings/:targetId_public
// Create or update own rating for a breeder (upsert)
router.post('/:targetId_public', async (req, res) => {
    try {
        const { targetId_public } = req.params;
        const raterId_backend = req.user.id;
        const raterId_public  = req.user.id_public;

        // Cannot rate yourself
        if (raterId_public === targetId_public) {
            return res.status(400).json({ message: 'You cannot rate yourself.' });
        }

        // Target must exist
        const targetProfile = await PublicProfile.findOne({ id_public: targetId_public }).lean();
        if (!targetProfile) {
            return res.status(404).json({ message: 'Breeder not found.' });
        }

        const { score, comment } = req.body;
        if (!score || score < 1 || score > 5) {
            return res.status(400).json({ message: 'Score must be between 1 and 5.' });
        }

        // Resolve display name
        const raterUser = await User.findById(raterId_backend).select('personalName showPersonalName breederName showBreederName').lean();
        let raterName = '';
        if (raterUser) {
            if (raterUser.showBreederName && raterUser.breederName) raterName = raterUser.breederName;
            else if (raterUser.showPersonalName && raterUser.personalName) raterName = raterUser.personalName;
            else raterName = raterId_public;
        }

        const rating = await BreederRating.findOneAndUpdate(
            { raterId_backend, targetId_public },
            { raterId_public, raterName, score: Number(score), comment: (comment || '').slice(0, 1000) },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        res.status(200).json({ message: 'Rating saved.', rating });
    } catch (err) {
        console.error('Error saving rating:', err);
        res.status(500).json({ message: 'Internal server error.' });
    }
});

// DELETE /api/ratings/:targetId_public
// Remove own rating
router.delete('/:targetId_public', async (req, res) => {
    try {
        const { targetId_public } = req.params;
        const raterId_backend = req.user.id;
        await BreederRating.deleteOne({ raterId_backend, targetId_public });
        res.status(200).json({ message: 'Rating removed.' });
    } catch (err) {
        console.error('Error deleting rating:', err);
        res.status(500).json({ message: 'Internal server error.' });
    }
});

// GET /api/ratings/:targetId_public/mine
// Get the current user's own rating for a target
router.get('/:targetId_public/mine', async (req, res) => {
    try {
        const { targetId_public } = req.params;
        const rating = await BreederRating.findOne({ raterId_backend: req.user.id, targetId_public }).lean();
        res.status(200).json(rating || null);
    } catch (err) {
        console.error('Error fetching own rating:', err);
        res.status(500).json({ message: 'Internal server error.' });
    }
});

module.exports = router;
