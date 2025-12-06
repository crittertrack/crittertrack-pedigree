const express = require('express');
const router = express.Router();
const { BugReport } = require('../database/models');
const { sendBugReportNotification } = require('../utils/emailService');

// Submit a new bug report
router.post('/', async (req, res) => {
    try {
        const { category, description, page } = req.body;
        const userId = req.user.userId;

        // Validate required fields
        if (!category || !description) {
            return res.status(400).json({ 
                error: 'Category and description are required' 
            });
        }

        // Get user details for the report
        const { User } = require('../database/models');
        const user = await User.findById(userId).select('username email');
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Create the bug report
        const bugReport = new BugReport({
            userId,
            userEmail: user.email,
            userName: user.username,
            category,
            description,
            page: page || null
        });

        await bugReport.save();

        // Send admin email notification
        try {
            await sendBugReportNotification({
                userName: user.username,
                userEmail: user.email,
                category,
                description,
                page: page || 'Not specified',
                createdAt: bugReport.createdAt
            });
        } catch (emailError) {
            console.error('Failed to send bug report notification email:', emailError);
            // Don't fail the request if email fails, report is still saved
        }

        res.status(201).json({
            message: 'Bug report submitted successfully',
            reportId: bugReport._id
        });
    } catch (error) {
        console.error('Error submitting bug report:', error);
        res.status(500).json({ error: 'Failed to submit bug report' });
    }
});

// Get all bug reports (admin only)
router.get('/admin', async (req, res) => {
    try {
        const userId = req.user.userId;
        const { User } = require('../database/models');
        const user = await User.findById(userId);

        if (!user || user.email !== 'crittertrackowner@gmail.com') {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const reports = await BugReport.find()
            .sort({ createdAt: -1 })
            .lean();

        res.json(reports);
    } catch (error) {
        console.error('Error fetching bug reports:', error);
        res.status(500).json({ error: 'Failed to fetch bug reports' });
    }
});

// Update bug report status (admin only)
router.patch('/:id/status', async (req, res) => {
    try {
        const userId = req.user.userId;
        const { User } = require('../database/models');
        const user = await User.findById(userId);

        if (!user || user.email !== 'crittertrackowner@gmail.com') {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const { id } = req.params;
        const { status, adminNotes } = req.body;

        const updateData = { status };
        if (adminNotes !== undefined) {
            updateData.adminNotes = adminNotes;
        }
        if (status === 'resolved') {
            updateData.resolvedAt = new Date();
        }

        const report = await BugReport.findByIdAndUpdate(
            id,
            updateData,
            { new: true }
        );

        if (!report) {
            return res.status(404).json({ error: 'Bug report not found' });
        }

        res.json(report);
    } catch (error) {
        console.error('Error updating bug report status:', error);
        res.status(500).json({ error: 'Failed to update bug report status' });
    }
});

// Get user's own bug reports
router.get('/my-reports', async (req, res) => {
    try {
        const userId = req.user.userId;

        const reports = await BugReport.find({ userId })
            .sort({ createdAt: -1 })
            .select('-userEmail -userName')
            .lean();

        res.json(reports);
    } catch (error) {
        console.error('Error fetching user bug reports:', error);
        res.status(500).json({ error: 'Failed to fetch your bug reports' });
    }
});

module.exports = router;
