const express = require('express');
const router = express.Router();
const { Location, Enclosure } = require('../database/models');
const { authenticateToken } = require('../middleware/auth'); // Assuming auth middleware exists

// GET all locations for the logged-in user
router.get('/', authenticateToken, async (req, res) => {
    try {
        const locations = await Location.find({ creatorId: req.user.id });
        res.json(locations);
    } catch (error) {
        console.error('Failed to fetch locations:', error);
        res.status(500).json({ message: 'Failed to fetch locations' });
    }
});

// POST a new location
router.post('/', authenticateToken, async (req, res) => {
    const { name, type, parentLocationId } = req.body;
    if (!name || !type) {
        return res.status(400).json({ message: 'Name and type are required' });
    }
    if (type === 'room' && !parentLocationId) {
        return res.status(400).json({ message: 'A room must have a parent building' });
    }

    try {
        const newLocation = new Location({
            creatorId: req.user.id,
            name,
            type,
            parentLocationId: type === 'building' ? null : parentLocationId,
        });
        await newLocation.save();
        res.status(201).json(newLocation);
    } catch (error) {
        console.error('Failed to create location:', error);
        res.status(500).json({ message: 'Failed to create location' });
    }
});

// PUT (update) an existing location
router.put('/:id', authenticateToken, async (req, res) => {
    const { name, parentLocationId } = req.body;
    if (!name) {
        return res.status(400).json({ message: 'Name is required' });
    }

    try {
        const location = await Location.findOne({ _id: req.params.id, creatorId: req.user.id });
        if (!location) {
            return res.status(404).json({ message: 'Location not found' });
        }

        location.name = name;
        if (location.type === 'room' && parentLocationId) {
            const parent = await Location.findOne({ _id: parentLocationId, creatorId: req.user.id, type: 'building' });
            if (!parent) {
                return res.status(400).json({ message: 'Invalid parent building' });
            }
            location.parentLocationId = parentLocationId;
        }
        
        await location.save();
        res.json(location);
    } catch (error) {
        console.error('Failed to update location:', error);
        res.status(500).json({ message: 'Failed to update location' });
    }
});

// DELETE a location
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        const location = await Location.findOne({ _id: req.params.id, creatorId: req.user.id });
        if (!location) {
            return res.status(404).json({ message: 'Location not found' });
        }

        if (location.type === 'building') {
            // If deleting a building, also find and delete its rooms
            const rooms = await Location.find({ parentLocationId: location._id });
            const roomIds = rooms.map(r => r._id);
            await Enclosure.updateMany({ creatorId: req.user.id, $or: [{ buildingId: location._id }, { roomId: { $in: roomIds } }] }, { $set: { buildingId: null, roomId: null } });
            await Location.deleteMany({ _id: { $in: roomIds } });
        } else { // It's a room
            await Enclosure.updateMany({ creatorId: req.user.id, roomId: location._id }, { $set: { roomId: null } });
        }

        await Location.deleteOne({ _id: req.params.id });
        res.status(204).send();
    } catch (error) {
        console.error('Failed to delete location:', error);
        res.status(500).json({ message: 'Failed to delete location' });
    }
});

module.exports = router;