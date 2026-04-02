const express = require('express');
const router = express.Router();
const { Favorite, PublicAnimal, PublicProfile, Animal } = require('../database/models');

// --- Favorites Routes (Auth Required) ---

// GET /api/favorites/animals - Get user's favorite animals
router.get('/animals', async (req, res) => {
    try {
        const userId = req.user.id; // From auth middleware

        // Get all animal favorites for this user
        const favorites = await Favorite.find({ 
            userId, 
            itemType: 'animal' 
        }).sort({ createdAt: -1 });

        // Fetch full animal data for each favorite
        const animalIds = favorites.map(f => f.itemId);
        const animals = await PublicAnimal.find({ 
            id_public: { $in: animalIds } 
        }).lean();

        // Return animals in the order they were favorited
        const orderedAnimals = animalIds
            .map(id => animals.find(a => a.id_public === id))
            .filter(a => a); // Filter out any nulls (deleted animals)

        res.status(200).json(orderedAnimals);
    } catch (error) {
        console.error('Error fetching favorite animals:', error);
        res.status(500).json({ message: 'Failed to fetch favorite animals' });
    }
});

// POST /api/favorites/animals/:animalId - Add animal to favorites
router.post('/animals/:animalId', async (req, res) => {
    try {
        const userId = req.user.id;
        const animalId = req.params.animalId; // id_public

        // Verify the animal exists
        const animal = await PublicAnimal.findOne({ id_public: animalId });
        if (!animal) {
            return res.status(404).json({ message: 'Animal not found' });
        }

        // Create or get existing favorite
        const favorite = await Favorite.findOneAndUpdate(
            { userId, itemType: 'animal', itemId: animalId },
            { userId, itemType: 'animal', itemId: animalId },
            { upsert: true, new: true }
        );

        res.status(200).json({ message: 'Animal added to favorites', favorite });
    } catch (error) {
        if (error.code === 11000) {
            // Duplicate key error - already favorited
            return res.status(200).json({ message: 'Animal already in favorites' });
        }
        console.error('Error adding favorite animal:', error);
        res.status(500).json({ message: 'Failed to add favorite animal' });
    }
});

// DELETE /api/favorites/animals/:animalId - Remove animal from favorites
router.delete('/animals/:animalId', async (req, res) => {
    try {
        const userId = req.user.id;
        const animalId = req.params.animalId; // id_public

        const result = await Favorite.deleteOne({ 
            userId, 
            itemType: 'animal', 
            itemId: animalId 
        });

        if (result.deletedCount === 0) {
            return res.status(404).json({ message: 'Favorite not found' });
        }

        res.status(200).json({ message: 'Animal removed from favorites' });
    } catch (error) {
        console.error('Error removing favorite animal:', error);
        res.status(500).json({ message: 'Failed to remove favorite animal' });
    }
});

// GET /api/favorites/users - Get user's favorite breeders
router.get('/users', async (req, res) => {
    try {
        const userId = req.user.id; // From auth middleware

        // Get all user favorites for this user
        const favorites = await Favorite.find({ 
            userId, 
            itemType: 'user' 
        }).sort({ createdAt: -1 });

        // Fetch full user profile data for each favorite
        const userIds = favorites.map(f => f.itemId);
        const profiles = await PublicProfile.find({ 
            id_public: { $in: userIds } 
        }).lean();

        // Return profiles in the order they were favorited
        const orderedProfiles = userIds
            .map(id => profiles.find(p => p.id_public === id))
            .filter(p => p); // Filter out any nulls (deleted users)

        res.status(200).json(orderedProfiles);
    } catch (error) {
        console.error('Error fetching favorite users:', error);
        res.status(500).json({ message: 'Failed to fetch favorite users' });
    }
});

// POST /api/favorites/users/:userId - Add user to favorites
router.post('/users/:userId', async (req, res) => {
    try {
        const currentUserId = req.user.id;
        const targetUserId = req.params.userId; // id_public

        // Prevent users from favoriting themselves
        if (req.user.id_public === targetUserId) {
            return res.status(400).json({ message: 'Cannot favorite yourself' });
        }

        // Verify the user exists
        const profile = await PublicProfile.findOne({ id_public: targetUserId });
        if (!profile) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Create or get existing favorite
        const favorite = await Favorite.findOneAndUpdate(
            { userId: currentUserId, itemType: 'user', itemId: targetUserId },
            { userId: currentUserId, itemType: 'user', itemId: targetUserId },
            { upsert: true, new: true }
        );

        res.status(200).json({ message: 'User added to favorites', favorite });
    } catch (error) {
        if (error.code === 11000) {
            // Duplicate key error - already favorited
            return res.status(200).json({ message: 'User already in favorites' });
        }
        console.error('Error adding favorite user:', error);
        res.status(500).json({ message: 'Failed to add favorite user' });
    }
});

// DELETE /api/favorites/users/:userId - Remove user from favorites
router.delete('/users/:userId', async (req, res) => {
    try {
        const currentUserId = req.user.id;
        const targetUserId = req.params.userId; // id_public

        const result = await Favorite.deleteOne({ 
            userId: currentUserId, 
            itemType: 'user', 
            itemId: targetUserId 
        });

        if (result.deletedCount === 0) {
            return res.status(404).json({ message: 'Favorite not found' });
        }

        res.status(200).json({ message: 'User removed from favorites' });
    } catch (error) {
        console.error('Error removing favorite user:', error);
        res.status(500).json({ message: 'Failed to remove favorite user' });
    }
});

module.exports = router;
