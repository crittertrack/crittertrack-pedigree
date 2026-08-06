const express = require('express');
const router = express.Router();
const { Resource, User } = require('../database/models');

// Middleware to check admin/moderator access
const requireAdmin = async (req, res, next) => {
    try {
        const userId = req.user?.userId || req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const user = await User.findById(userId).select('role');
        if (!user || !['admin', 'moderator'].includes(user.role)) {
            return res.status(403).json({ error: 'Admin or moderator access required' });
        }

        req.adminUser = user;
        next();
    } catch (error) {
        console.error('Admin check error:', error);
        res.status(500).json({ error: 'Authorization check failed' });
    }
};

// ============================================
// RESOURCES MANAGEMENT ROUTES
// ============================================

// GET /api/admin/resources - Get all resources
router.get('/resources', requireAdmin, async (req, res) => {
    try {
        const resources = await Resource.find({}).sort({ createdAt: -1 });
        res.json(resources);
    } catch (error) {
        console.error('Error fetching resources:', error);
        res.status(500).json({ error: 'Failed to fetch resources' });
    }
});

// POST /api/admin/resources - Add a new resource
router.post('/resources', requireAdmin, async (req, res) => {
    try {
        const { title, url, description, subject, species, tags } = req.body;

        if (!title?.trim() || !url?.trim()) {
            return res.status(400).json({ error: 'Title and URL are required' });
        }

        const newResource = new Resource({
            title: title.trim(),
            url: url.trim(),
            description: description?.trim() || '',
            subject: subject?.trim() || '',
            species: Array.isArray(species) ? species.filter(Boolean) : [],
            tags: Array.isArray(tags) ? tags.map(t => t.trim().toLowerCase()).filter(Boolean) : [],
            createdBy: req.user._id || req.user.id
        });

        await newResource.save();
        res.status(201).json(newResource);
    } catch (error) {
        console.error('Error creating resource:', error);
        res.status(500).json({ error: 'Failed to create resource' });
    }
});

// PATCH /api/admin/resources/:id - Update a resource
router.patch('/resources/:id', requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { title, url, description, subject, species, tags } = req.body;

        const resource = await Resource.findById(id);
        if (!resource) {
            return res.status(404).json({ error: 'Resource not found' });
        }

        if (title !== undefined) resource.title = title.trim();
        if (url !== undefined) resource.url = url.trim();
        if (description !== undefined) resource.description = description?.trim() || '';
        if (subject !== undefined) resource.subject = subject?.trim() || '';
        if (species !== undefined) resource.species = Array.isArray(species) ? species.filter(Boolean) : [];
        if (tags !== undefined) resource.tags = Array.isArray(tags) ? tags.map(t => t.trim().toLowerCase()).filter(Boolean) : [];

        await resource.save();
        res.json(resource);
    } catch (error) {
        console.error('Error updating resource:', error);
        res.status(500).json({ error: 'Failed to update resource' });
    }
});

// DELETE /api/admin/resources/:id - Delete a resource
router.delete('/resources/:id', requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const resource = await Resource.findByIdAndDelete(id);
        if (!resource) {
            return res.status(404).json({ error: 'Resource not found' });
        }
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting resource:', error);
        res.status(500).json({ error: 'Failed to delete resource' });
    }
});

module.exports = router;
