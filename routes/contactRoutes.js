const express = require('express');
const router = express.Router();
const Contact = require('../database/contactModel');
const { Animal } = require('../database/models');
const { protect } = require('../middleware/authMiddleware');

// Apply authentication to all routes
router.use(protect);

// GET /api/contacts - Get all contacts for the logged-in user
router.get('/', async (req, res) => {
    try {
        const { type } = req.query; // Filter by type: 'keeper', 'breeder', or 'all'
        
        let filter = { userId: req.user._id };
        
        // Apply type filter if specified
        if (type === 'keeper') {
            filter.isKeeper = true;
        } else if (type === 'breeder') {
            filter.isBreeder = true;
        }
        
        const contacts = await Contact.find(filter)
            .sort({ updatedAt: -1 })
            .lean();
        
        res.json(contacts);
    } catch (error) {
        console.error('[CONTACTS] Error fetching contacts:', error);
        res.status(500).json({ message: 'Failed to fetch contacts', error: error.message });
    }
});

// GET /api/contacts/:id - Get a single contact by ID
router.get('/:id', async (req, res) => {
    try {
        const contact = await Contact.findOne({
            _id: req.params.id,
            userId: req.user._id
        }).lean();
        
        if (!contact) {
            return res.status(404).json({ message: 'Contact not found' });
        }
        
        res.json(contact);
    } catch (error) {
        console.error('[CONTACTS] Error fetching contact:', error);
        res.status(500).json({ message: 'Failed to fetch contact', error: error.message });
    }
});

// POST /api/contacts - Create a new contact
router.post('/', async (req, res) => {
    try {
        const {
            linkedCTUID,
            personalName,
            breederName,
            prefix,
            suffix,
            address,
            isKeeper,
            isBreeder,
            notes
        } = req.body;
        
        // Validate that at least one type is selected
        if (!isKeeper && !isBreeder) {
            return res.status(400).json({ message: 'Contact must be marked as keeper, breeder, or both' });
        }
        
        // Validate that at least one name is provided
        if (!personalName && !breederName) {
            return res.status(400).json({ message: 'At least one name (personal or breeder) is required' });
        }
        
        const newContact = new Contact({
            userId: req.user._id,
            linkedCTUID: linkedCTUID || null,
            personalName: personalName || null,
            breederName: breederName || null,
            prefix: prefix || null,
            suffix: suffix || null,
            address: address || {},
            isKeeper: !!isKeeper,
            isBreeder: !!isBreeder,
            notes: notes || null,
            assignedAnimals: []
        });
        
        await newContact.save();
        
        res.status(201).json(newContact);
    } catch (error) {
        console.error('[CONTACTS] Error creating contact:', error);
        res.status(500).json({ message: 'Failed to create contact', error: error.message });
    }
});

// PUT /api/contacts/:id - Update a contact
router.put('/:id', async (req, res) => {
    try {
        const contact = await Contact.findOne({
            _id: req.params.id,
            userId: req.user._id
        });
        
        if (!contact) {
            return res.status(404).json({ message: 'Contact not found' });
        }
        
        const {
            linkedCTUID,
            personalName,
            breederName,
            prefix,
            suffix,
            address,
            isKeeper,
            isBreeder,
            notes
        } = req.body;
        
        // Validate that at least one type is selected
        if (!isKeeper && !isBreeder) {
            return res.status(400).json({ message: 'Contact must be marked as keeper, breeder, or both' });
        }
        
        // Validate that at least one name is provided
        if (!personalName && !breederName) {
            return res.status(400).json({ message: 'At least one name (personal or breeder) is required' });
        }
        
        // Update fields
        contact.linkedCTUID = linkedCTUID || null;
        contact.personalName = personalName || null;
        contact.breederName = breederName || null;
        contact.prefix = prefix || null;
        contact.suffix = suffix || null;
        contact.address = address || {};
        contact.isKeeper = !!isKeeper;
        contact.isBreeder = !!isBreeder;
        contact.notes = notes || null;
        
        await contact.save();
        
        res.json(contact);
    } catch (error) {
        console.error('[CONTACTS] Error updating contact:', error);
        res.status(500).json({ message: 'Failed to update contact', error: error.message });
    }
});

// DELETE /api/contacts/:id - Delete a contact
router.delete('/:id', async (req, res) => {
    try {
        const contact = await Contact.findOneAndDelete({
            _id: req.params.id,
            userId: req.user._id
        });
        
        if (!contact) {
            return res.status(404).json({ message: 'Contact not found' });
        }
        
        res.json({ message: 'Contact deleted successfully' });
    } catch (error) {
        console.error('[CONTACTS] Error deleting contact:', error);
        res.status(500).json({ message: 'Failed to delete contact', error: error.message });
    }
});

// POST /api/contacts/:id/assign-animal - Assign an animal to a contact
router.post('/:id/assign-animal', async (req, res) => {
    try {
        const { animalId_public, role } = req.body;
        
        if (!animalId_public || !role) {
            return res.status(400).json({ message: 'Animal ID and role are required' });
        }
        
        if (!['keeper', 'breeder', 'both'].includes(role)) {
            return res.status(400).json({ message: 'Invalid role. Must be keeper, breeder, or both' });
        }
        
        // Find the contact
        const contact = await Contact.findOne({
            _id: req.params.id,
            userId: req.user._id
        });
        
        if (!contact) {
            return res.status(404).json({ message: 'Contact not found' });
        }
        
        // Find the animal and verify ownership
        const animal = await Animal.findOne({
            id_public: animalId_public,
            ownerId: req.user._id
        });
        
        if (!animal) {
            return res.status(404).json({ message: 'Animal not found or you do not own this animal' });
        }
        
        // Check if animal is already assigned to this contact
        const existingAssignment = contact.assignedAnimals.find(
            a => a.animalId_public === animalId_public
        );
        
        if (existingAssignment) {
            // Update the role if it changed
            existingAssignment.role = role;
        } else {
            // Add new assignment
            contact.assignedAnimals.push({
                animalId: animal._id,
                animalId_public: animalId_public,
                role: role,
                assignedDate: new Date()
            });
        }
        
        await contact.save();
        
        res.json(contact);
    } catch (error) {
        console.error('[CONTACTS] Error assigning animal:', error);
        res.status(500).json({ message: 'Failed to assign animal', error: error.message });
    }
});

// DELETE /api/contacts/:id/assign-animal/:animalId_public - Remove an animal assignment
router.delete('/:id/assign-animal/:animalId_public', async (req, res) => {
    try {
        const contact = await Contact.findOne({
            _id: req.params.id,
            userId: req.user._id
        });
        
        if (!contact) {
            return res.status(404).json({ message: 'Contact not found' });
        }
        
        // Remove the animal from assignedAnimals
        contact.assignedAnimals = contact.assignedAnimals.filter(
            a => a.animalId_public !== req.params.animalId_public
        );
        
        await contact.save();
        
        res.json(contact);
    } catch (error) {
        console.error('[CONTACTS] Error removing animal assignment:', error);
        res.status(500).json({ message: 'Failed to remove animal assignment', error: error.message });
    }
});

// GET /api/contacts/:id/animals - Get all animals assigned to a contact with full details
router.get('/:id/animals', async (req, res) => {
    try {
        const { role } = req.query; // Filter by role: 'keeper', 'breeder', or 'all'
        
        const contact = await Contact.findOne({
            _id: req.params.id,
            userId: req.user._id
        });
        
        if (!contact) {
            return res.status(404).json({ message: 'Contact not found' });
        }
        
        // Filter assignments by role if specified
        let assignments = contact.assignedAnimals;
        if (role && role !== 'all') {
            assignments = assignments.filter(a => a.role === role || a.role === 'both');
        }
        
        // Get animal IDs
        const animalIds = assignments.map(a => a.animalId);
        
        // Fetch full animal details
        const animals = await Animal.find({
            _id: { $in: animalIds },
            ownerId: req.user._id
        }).lean();
        
        // Combine animal data with assignment info
        const result = animals.map(animal => {
            const assignment = assignments.find(a => a.animalId.toString() === animal._id.toString());
            return {
                ...animal,
                contactRole: assignment.role,
                assignedDate: assignment.assignedDate
            };
        });
        
        res.json(result);
    } catch (error) {
        console.error('[CONTACTS] Error fetching contact animals:', error);
        res.status(500).json({ message: 'Failed to fetch contact animals', error: error.message });
    }
});

module.exports = router;
