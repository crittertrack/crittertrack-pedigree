const express = require('express');
const router = express.Router();
const { GeneticsFeedback } = require('../database/models');
const { sendGeneticsFeedbackNotification } = require('../utils/emailService');

/**
 * POST /genetics-feedback
 * Submit feedback about incorrect or unknown phenotypes
 * Requires authentication
 */
router.post('/', async (req, res) => {
    try {
        const { phenotype, genotype, feedback } = req.body;
        const userId = req.user?.userId;

        // Validation
        if (!phenotype || !genotype || !feedback) {
            return res.status(400).json({ 
                message: 'Missing required fields: phenotype, genotype, and feedback are required' 
            });
        }

        // Create feedback entry
        const newFeedback = await GeneticsFeedback.create({
            userId: userId || null,
            phenotype,
            genotype,
            feedback,
            status: 'pending',
            createdAt: new Date()
        });

        // Send admin email notification
        try {
            const { User } = require('../database/models');
            let userName = 'Anonymous';
            let userEmail = 'Not logged in';
            
            if (userId) {
                const user = await User.findById(userId).select('username email personalName');
                if (user) {
                    userName = user.username || user.personalName || 'Unknown User';
                    userEmail = user.email;
                }
            }

            await sendGeneticsFeedbackNotification({
                userName,
                userEmail,
                phenotype,
                genotype,
                feedback,
                createdAt: newFeedback.createdAt
            });
        } catch (emailError) {
            console.error('Failed to send genetics feedback notification email:', emailError);
            // Don't fail the request if email fails, feedback is still saved
        }

        return res.status(201).json({ 
            message: 'Feedback submitted successfully',
            feedbackId: newFeedback.id
        });

    } catch (error) {
        console.error('Error submitting genetics feedback:', error);
        return res.status(500).json({ 
            message: 'Failed to submit feedback',
            error: error.message 
        });
    }
});

/**
 * GET /genetics-feedback/admin
 * Get all feedback submissions (admin only)
 */
router.get('/admin', async (req, res) => {
    try {
        // Check if user is admin
        if (!req.user?.isAdmin) {
            return res.status(403).json({ message: 'Access denied. Admin only.' });
        }

        const feedback = await GeneticsFeedback.findAll({
            order: [['createdAt', 'DESC']],
            include: [{
                model: require('../database/models').User,
                attributes: ['id', 'username', 'email']
            }]
        });

        return res.status(200).json(feedback);

    } catch (error) {
        console.error('Error fetching genetics feedback:', error);
        return res.status(500).json({ 
            message: 'Failed to fetch feedback',
            error: error.message 
        });
    }
});

/**
 * PATCH /genetics-feedback/:id/status
 * Update feedback status (admin only)
 */
router.patch('/:id/status', async (req, res) => {
    try {
        // Check if user is admin
        if (!req.user?.isAdmin) {
            return res.status(403).json({ message: 'Access denied. Admin only.' });
        }

        const { id } = req.params;
        const { status, adminNotes } = req.body;

        if (!['pending', 'reviewed', 'resolved', 'dismissed'].includes(status)) {
            return res.status(400).json({ 
                message: 'Invalid status. Must be: pending, reviewed, resolved, or dismissed' 
            });
        }

        const feedback = await GeneticsFeedback.findByPk(id);
        if (!feedback) {
            return res.status(404).json({ message: 'Feedback not found' });
        }

        feedback.status = status;
        if (adminNotes) {
            feedback.adminNotes = adminNotes;
        }
        feedback.reviewedAt = new Date();
        await feedback.save();

        return res.status(200).json({ 
            message: 'Feedback status updated',
            feedback 
        });

    } catch (error) {
        console.error('Error updating feedback status:', error);
        return res.status(500).json({ 
            message: 'Failed to update feedback status',
            error: error.message 
        });
    }
});

module.exports = router;
