const express = require('express');
const authMiddleware = require('../middleware/auth');
const VmUserSetup = require('../../database/vmModels');

const router = express.Router();

// @route   POST /api/virtual-mousery/setup
// @desc    Save user's name + logo choice to separate VM database
// @access  Private (uses existing JWT token from login - NO changes needed!)
router.post('/', authMiddleware, async (req, res) => {
    try {
        const { name, logoIndex } = req.body;
        const userId = req.user.id; // From EXISTING login token - NO changes needed!

        // Validation
        if (!name || name.trim().length === 0) {
            return res.status(400).json({ error: 'Name is required' });
        }

        if (!logoIndex || logoIndex < 1 || logoIndex > 9) {
            return res.status(400).json({ error: 'Invalid logo index (must be 1-9)' });
        }

        // Find existing or create new setup for this user
        const setup = await VmUserSetup.findOneAndUpdate(
            { userId }, // Match by userId from token
            {
                name: name.trim(),
                logoIndex,
                updatedAt: new Date()
            },
            {
                upsert: true, // Create if doesn't exist
                new: true, // Return the updated document
                runValidators: true
            }
        );

        console.log(`✅ VM setup saved for user ${userId}: name="${name}", logoIndex=${logoIndex} (in separate DB)`);

        res.json({
            success: true,
            data: {
                name: setup.name,
                logoIndex: setup.logoIndex,
                id: setup._id
            }
        });

    } catch (err) {
        console.error('❌ Error saving VM setup:', err.message);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// @route   GET /api/virtual-mousery/setup
// @desc    Fetch user's saved name + logo from separate VM database
// @access  Private (uses existing JWT token from login - NO changes needed!)
router.get('/', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id; // From EXISTING login token - NO changes needed!

        // Find user's VM setup
        const setup = await VmUserSetup.findOne({ userId });

        if (setup) {
            console.log(`📋 VM setup fetched for user ${userId}: name="${setup.name}", logoIndex=${setup.logoIndex} (from separate DB)`);
            res.json({
                success: true,
                data: {
                    name: setup.name,
                    logoIndex: setup.logoIndex,
                    id: setup._id,
                    createdAt: setup.createdAt
                }
            });
        } else {
            // No setup found - return defaults
            res.json({
                success: true,
                data: {
                    name: 'Guest',
                    logoIndex: 1,
                    id: null,
                    createdAt: null
                }
            });
        }

    } catch (err) {
        console.error('❌ Error fetching VM setup:', err.message);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// @route   PUT /api/virtual-mousery/setup
// @desc    Update user's name + logo choice
// @access  Private (uses existing JWT token from login)
router.put('/', authMiddleware, async (req, res) => {
    try {
        const { name, logoIndex } = req.body;
        const userId = req.user.id; // From EXISTING login token

        if (!name || name.trim().length === 0) {
            return res.status(400).json({ error: 'Name is required' });
        }

        if (!logoIndex || logoIndex < 1 || logoIndex > 9) {
            return res.status(400).json({ error: 'Invalid logo index (must be 1-9)' });
        }

        const setup = await VmUserSetup.findOneAndUpdate(
            { userId },
            {
                name: name.trim(),
                logoIndex,
                updatedAt: new Date()
            },
            {
                new: true,
                runValidators: true
            }
        );

        res.json({
            success: true,
            data: {
                name: setup.name,
                logoIndex: setup.logoIndex
            }
        });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
