const express = require('express');
const router = express.Router();
const { BugReport, Notification, User, ProfileReport, AnimalReport, MessageReport, RatingReport } = require('../database/models');
const { sendBugReportNotification } = require('../utils/emailService');

// Parses the "Category · Field :: Description" reason format used by ReportModal
// (profile/animal/message/rating reports) so it can be displayed like a bug report.
const parseReasonForDisplay = (reason = '') => {
    if (!reason) return { category: 'Report', description: '' };
    const [headerPart, detailPart] = reason.split('::').map((part) => (part || '').trim());
    const [category] = (headerPart || '').split('\u00b7').map((part) => (part || '').trim());
    return { category: category || 'Report', description: detailPart || reason };
};

// Submit a new bug report
router.post('/', async (req, res) => {
    try {
        const { category, description, stepsToReproduce, images, browserInfo, page } = req.body;
        const userId = req.user.id;

        // Validate required fields
        if (!category || !description) {
            return res.status(400).json({ 
                error: 'Category and description are required' 
            });
        }

        // Validate category
        const validCategories = ['Bug', 'Feature Request', 'General Feedback'];
        if (!validCategories.includes(category)) {
            return res.status(400).json({ 
                error: 'Invalid category. Must be: Bug, Feature Request, or General Feedback' 
            });
        }

        // Validate images array
        if (images && !Array.isArray(images)) {
            return res.status(400).json({ 
                error: 'Images must be an array of URLs' 
            });
        }

        if (images && images.length > 5) {
            return res.status(400).json({ 
                error: 'Maximum 5 images allowed per report' 
            });
        }

        // Get user details for the report
        const { User } = require('../database/models');
        const user = await User.findById(userId).select('personalName breederName email');
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Create the bug report with all new fields
        const bugReport = new BugReport({
            userId,
            userEmail: user.email,
            userName: user.personalName || user.breederName || 'Anonymous',
            category,
            description,
            stepsToReproduce: stepsToReproduce || null,
            images: images || [],
            browserInfo: browserInfo || null,
            page: page || null
        });

        await bugReport.save();

        // Send admin email notification with extended info
        try {
            await sendBugReportNotification({
                userName: user.personalName || user.breederName || 'Anonymous',
                userEmail: user.email,
                category,
                description,
                stepsToReproduce: stepsToReproduce || null,
                images: images || [],
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
        // req.user is already populated by authMiddleware
        if (!req.user || !['admin', 'moderator'].includes(req.user.role)) {
            return res.status(403).json({ error: 'Admin or moderator access required' });
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
        // req.user is already populated by authMiddleware
        if (!req.user || req.user.email !== 'crittertrackowner@gmail.com') {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const { id } = req.params;
        const { status, adminNotes } = req.body;

        const existing = await BugReport.findById(id).select('status userId category');
        if (!existing) {
            return res.status(404).json({ error: 'Bug report not found' });
        }
        const statusChanged = status !== undefined && status !== existing.status;

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

        // Let the submitter know their report's status changed
        if (statusChanged) {
            try {
                const user = await User.findById(report.userId).select('id_public');
                const statusLabels = { pending: 'Pending', 'in-progress': 'In Progress', resolved: 'Resolved', dismissed: 'Dismissed' };
                await Notification.create({
                    userId: report.userId,
                    userId_public: user?.id_public || null,
                    type: 'bug_report_update',
                    status: 'pending',
                    message: `Your ${report.category} report has been marked as ${statusLabels[status] || status}.${adminNotes ? ` Note: ${adminNotes}` : ''}`,
                });
            } catch (notifyError) {
                console.error('Failed to create bug report status notification:', notifyError);
                // Don't fail the request if notification creation fails, status is still saved
            }
        }

        res.json(report);
    } catch (error) {
        console.error('Error updating bug report status:', error);
        res.status(500).json({ error: 'Failed to update bug report status' });
    }
});

// Get user's own reports (bug reports plus any profile/animal/message/rating reports they've filed)
router.get('/my-reports', async (req, res) => {
    try {
        const userId = req.user.id; // Fixed: use req.user.id, not req.user._id

        const [bugReports, profileReports, animalReports, messageReports, ratingReports] = await Promise.all([
            BugReport.find({ userId })
                .sort({ createdAt: -1 })
                .select('-userEmail -userName')
                .lean(),
            ProfileReport.find({ reporterId: userId })
                .populate({ path: 'reportedUserId', select: 'personalName breederName id_public' })
                .sort({ createdAt: -1 })
                .lean(),
            AnimalReport.find({ reporterId: userId })
                .populate({ path: 'reportedAnimalId', select: 'name id_public' })
                .sort({ createdAt: -1 })
                .lean(),
            MessageReport.find({ reporterId: userId })
                .sort({ createdAt: -1 })
                .lean(),
            RatingReport.find({ reporterId: userId })
                .populate({ path: 'ratingId', select: 'targetId_public' })
                .sort({ createdAt: -1 })
                .lean()
        ]);

        const normalizedBug = bugReports.map((r) => ({
            _id: r._id,
            _reportType: 'bug',
            category: r.category,
            subjectLabel: null,
            description: r.description,
            status: r.status,
            adminNotes: r.adminNotes || null,
            createdAt: r.createdAt
        }));

        const normalizedProfile = profileReports.map((r) => {
            const { category, description } = parseReasonForDisplay(r.reason);
            const user = r.reportedUserId;
            const name = user?.breederName || user?.personalName || user?.id_public || 'a profile';
            return {
                _id: r._id,
                _reportType: 'profile',
                category,
                subjectLabel: `Profile: ${name}`,
                description,
                status: r.status,
                adminNotes: r.adminNotes || null,
                createdAt: r.createdAt
            };
        });

        const normalizedAnimal = animalReports.map((r) => {
            const { category, description } = parseReasonForDisplay(r.reason);
            const animal = r.reportedAnimalId;
            const name = animal?.name || animal?.id_public || 'an animal';
            return {
                _id: r._id,
                _reportType: 'animal',
                category,
                subjectLabel: `Animal: ${name}`,
                description,
                status: r.status,
                adminNotes: r.adminNotes || null,
                createdAt: r.createdAt
            };
        });

        const normalizedMessage = messageReports.map((r) => {
            const { category, description } = parseReasonForDisplay(r.reason);
            return {
                _id: r._id,
                _reportType: 'message',
                category,
                subjectLabel: r.reportType === 'conversation' ? 'Conversation' : 'Direct Message',
                description,
                status: r.status,
                adminNotes: r.adminNotes || null,
                createdAt: r.createdAt
            };
        });

        const normalizedRating = ratingReports.map((r) => {
            const { category, description } = parseReasonForDisplay(r.reason);
            const target = r.ratingId?.targetId_public;
            return {
                _id: r._id,
                _reportType: 'rating',
                category,
                subjectLabel: target ? `Rating for ${target}` : 'Rating',
                description,
                status: r.status,
                adminNotes: r.adminNotes || null,
                createdAt: r.createdAt
            };
        });

        const allReports = [
            ...normalizedBug,
            ...normalizedProfile,
            ...normalizedAnimal,
            ...normalizedMessage,
            ...normalizedRating
        ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        res.json(allReports);
    } catch (error) {
        console.error('Error fetching user reports:', error);
        res.status(500).json({ error: 'Failed to fetch your reports' });
    }
});

module.exports = router;
