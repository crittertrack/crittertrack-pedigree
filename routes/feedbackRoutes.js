const express = require('express');
const router = express.Router();
const { Feedback } = require('../database/models');
const { sendFeedbackNotification } = require('../utils/emailService');

// Submit general feedback (species customization, UI, etc.)
router.post('/species', async (req, res) => {
    try {
        const { species, feedback, type } = req.body;
        const userId = req.user.id;

        // Validate required fields
        if (!feedback || !feedback.trim()) {
            return res.status(400).json({ 
                error: 'Feedback text is required' 
            });
        }

        // Get user details for the feedback
        const { User } = require('../database/models');
        const user = await User.findById(userId).select('id_public email personalName breederName');
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Create the feedback entry
        const newFeedback = new Feedback({
            userId,
            userIdPublic: user.id_public,
            userEmail: user.email,
            userName: user.personalName || user.breederName || 'Anonymous',
            species: species || null,
            feedback: feedback.trim(),
            type: type || 'general',
            status: 'pending'
        });

        await newFeedback.save();

        // Send admin email notification
        try {
            await sendFeedbackNotification({
                userName: user.personalName || user.breederName || 'Anonymous',
                userEmail: user.email,
                userIdPublic: user.id_public,
                species: species || 'Not specified',
                feedback: feedback.trim(),
                type: type || 'general',
                createdAt: newFeedback.createdAt
            });
        } catch (emailError) {
            console.error('Failed to send feedback notification email:', emailError);
            // Don't fail the request if email fails, feedback is still saved
        }

        res.status(201).json({
            message: 'Feedback submitted successfully',
            feedbackId: newFeedback._id
        });
    } catch (error) {
        console.error('Error submitting feedback:', error);
        res.status(500).json({ error: 'Failed to submit feedback' });
    }
});

// Get all feedback (admin only)
router.get('/admin', async (req, res) => {
    try {
        // req.user is already populated by authMiddleware
        if (!req.user || !['admin', 'moderator'].includes(req.user.role)) {
            return res.status(403).json({ error: 'Admin or moderator access required' });
        }

        const feedbackList = await Feedback.find()
            .sort({ createdAt: -1 })
            .lean();

        res.json(feedbackList);
    } catch (error) {
        console.error('Error fetching feedback:', error);
        res.status(500).json({ error: 'Failed to fetch feedback' });
    }
});

// Update feedback status (admin only)
router.patch('/:id/status', async (req, res) => {
    try {
        // req.user is already populated by authMiddleware
        if (!req.user || req.user.email !== 'crittertrackowner@gmail.com') {
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

        const feedback = await Feedback.findByIdAndUpdate(
            id,
            updateData,
            { new: true }
        );

        if (!feedback) {
            return res.status(404).json({ error: 'Feedback not found' });
        }

        res.json(feedback);
    } catch (error) {
        console.error('Error updating feedback status:', error);
        res.status(500).json({ error: 'Failed to update feedback status' });
    }
});

module.exports = router;
