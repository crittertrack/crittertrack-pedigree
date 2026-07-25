const express = require('express');
const router = express.Router();
const { Location, Enclosure } = require('../database/models');

// GET all locations for the logged-in user
// The auth middleware is applied in index.js, so we don't need it here.
router.get('/', async (req, res) => {
    try {
        const locations = await Location.find({ creatorId: req.user.id }).sort({ name: 1 });
        res.json(locations);
    } catch (error) {
        console.error('Failed to fetch locations:', error);
        res.status(500).json({ message: 'Failed to fetch locations' });
    }
});

// POST a new location
router.post('/', async (req, res) => {
    const { name, type, parentLocationId, address } = req.body;
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
            address: type === 'building' ? address : null,
        });
        await newLocation.save();
        res.status(201).json(newLocation);
    } catch (error) {
        console.error('Failed to create location:', error);
        res.status(500).json({ message: 'Failed to create location' });
    }
});

// PUT (update) an existing location
router.put('/:id', async (req, res) => {
    const { name, parentLocationId, address } = req.body;
    if (!name) {
        return res.status(400).json({ message: 'Name is required' });
    }

    try {
        const location = await Location.findOne({ _id: req.params.id, creatorId: req.user.id });
        if (!location) {
            return res.status(404).json({ message: 'Location not found' });
        }

        location.name = name;
        // Only allow updating address for buildings
        if (location.type === 'building' && address) {
            location.address = address;
        }
        // Only allow updating parentLocationId for rooms
        if (location.type === 'room') {
            // A null parentLocationId is valid (making it an unassigned room)
            if (parentLocationId) {
                const parent = await Location.findOne({ _id: parentLocationId, creatorId: req.user.id, type: 'building' });
                if (!parent) {
                    return res.status(400).json({ message: 'Invalid parent building' });
                }
                location.parentLocationId = parentLocationId;
            } else {
                location.parentLocationId = null;
            }
        }
        
        await location.save();
        res.json(location);
    } catch (error) {
        console.error('Failed to update location:', error);
        res.status(500).json({ message: 'Failed to update location' });
    }
});

// DELETE a location
router.delete('/:id', async (req, res) => {
    try {
        const location = await Location.findOne({ _id: req.params.id, creatorId: req.user.id });
        if (!location) {
            return res.status(404).json({ message: 'Location not found' });
        }

        if (location.type === 'building') {
            // If deleting a building, also find and delete its rooms
            const rooms = await Location.find({ parentLocationId: location._id });
            const roomIds = rooms.map(r => r._id);
            // Unassign enclosures from the building and any of its rooms
            await Enclosure.updateMany(
                { creatorId: req.user.id, $or: [{ buildingId: location._id }, { roomId: { $in: roomIds } }] },
                { $set: { buildingId: null, roomId: null } }
            );
            // Delete the rooms
            await Location.deleteMany({ _id: { $in: roomIds } });
        } else { // It's a room
            // Unassign enclosures from just this room
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