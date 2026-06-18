const express = require('express');
const router = express.Router();
const Contact = require('../database/contactModel');
const { Animal, User, PublicProfile } = require('../database/models');
const { protect } = require('../middleware/authMiddleware');

// Apply authentication to all routes
router.use(protect);

// GET /api/contacts/users - Get list of users for CTUID selector
router.get('/users', async (req, res) => {
    try {
        const { search } = req.query;
        
        let filter = {};
        
        // If search term provided, filter by id_public, personalName, or breederName
        if (search && search.trim()) {
            const searchRegex = new RegExp(search.trim(), 'i');
            filter.$or = [
                { id_public: searchRegex },
                { personalName: searchRegex },
                { breederName: searchRegex }
            ];
        }
        
        // Get users from PublicProfile collection (contains public data)
        const users = await PublicProfile.find(filter)
            .select('id_public personalName breederName country state')
            .limit(100)
            .sort({ id_public: 1 })
            .lean();
        
        res.json(users);
    } catch (error) {
        console.error('[CONTACTS] Error fetching users:', error);
        res.status(500).json({ message: 'Failed to fetch users', error: error.message });
    }
});

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

// GET /api/contacts/:id/bred-animals - Get animals bred by this contact that are owned by current user
router.get('/:id/bred-animals', async (req, res) => {
    try {
        const contact = await Contact.findOne({
            _id: req.params.id,
            userId: req.user._id
        });
        
        if (!contact) {
            return res.status(404).json({ message: 'Contact not found' });
        }
        
        let animals = [];
        
        // If contact has a linked CTUID, find animals bred by this contact
        if (contact.linkedCTUID) {
            animals = await Animal.find({
                breederId_public: contact.linkedCTUID,
                ownerId: req.user._id,
                archived: { $ne: true } // Exclude archived animals
            })
            .select('id_public name prefix suffix species gender birthDate deceasedDate status color imageUrl photoUrl breederId_public')
            .sort({ birthDate: -1 })
            .lean();
        }
        
        // Also include manually assigned animals with 'breeder' or 'both' role
        const assignedBreederAnimals = contact.assignedAnimals
            .filter(a => a.role === 'breeder' || a.role === 'both')
            .map(a => a.animalId_public);
        
        if (assignedBreederAnimals.length > 0) {
            const manualAnimals = await Animal.find({
                id_public: { $in: assignedBreederAnimals },
                ownerId: req.user._id,
                archived: { $ne: true }
            })
            .select('id_public name prefix suffix species gender birthDate deceasedDate status color imageUrl photoUrl breederId_public')
            .sort({ birthDate: -1 })
            .lean();
            
            // Merge and deduplicate by id_public
            const animalMap = new Map();
            [...animals, ...manualAnimals].forEach(animal => {
                animalMap.set(animal.id_public, animal);
            });
            animals = Array.from(animalMap.values());
        }
        
        res.json(animals);
    } catch (error) {
        console.error('[CONTACTS] Error fetching bred animals:', error);
        res.status(500).json({ message: 'Failed to fetch bred animals', error: error.message });
    }
});

// GET /api/contacts/:id/own-animals - Get animals bred by current user that are owned by this contact
router.get('/:id/own-animals', async (req, res) => {
    try {
        const contact = await Contact.findOne({
            _id: req.params.id,
            userId: req.user._id
        });
        
        if (!contact) {
            return res.status(404).json({ message: 'Contact not found' });
        }
        
        let animals = [];
        
        // If contact has a linked CTUID, find animals bred by current user owned by this contact
        if (contact.linkedCTUID) {
            animals = await Animal.find({
                breederId_public: req.user.id_public,
                ownerId_public: contact.linkedCTUID,
                archived: { $ne: true } // Exclude archived animals
            })
            .select('id_public name prefix suffix species gender birthDate deceasedDate status color imageUrl photoUrl ownerId_public')
            .sort({ birthDate: -1 })
            .lean();
        }
        
        // Also include manually assigned animals with 'keeper' or 'both' role
        const assignedKeeperAnimals = contact.assignedAnimals
            .filter(a => a.role === 'keeper' || a.role === 'both')
            .map(a => a.animalId_public);
        
        if (assignedKeeperAnimals.length > 0) {
            const manualAnimals = await Animal.find({
                id_public: { $in: assignedKeeperAnimals },
                ownerId: req.user._id,
                archived: { $ne: true }
            })
            .select('id_public name prefix suffix species gender birthDate deceasedDate status color imageUrl photoUrl ownerId_public')
            .sort({ birthDate: -1 })
            .lean();
            
            // Merge and deduplicate by id_public
            const animalMap = new Map();
            [...animals, ...manualAnimals].forEach(animal => {
                animalMap.set(animal.id_public, animal);
            });
            animals = Array.from(animalMap.values());
        }
        
        res.json(animals);
    } catch (error) {
        console.error('[CONTACTS] Error fetching own animals:', error);
        res.status(500).json({ message: 'Failed to fetch own animals', error: error.message });
    }
});

module.exports = router;
