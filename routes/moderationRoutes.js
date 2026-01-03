const express = require('express');
const router = express.Router();
const { checkRole } = require('../middleware/authMiddleware');
const { createAuditLog, getAuditLogs } = require('../utils/auditLogger');
const {
    User,
    ProfileReport,
    AnimalReport,
    MessageReport
} = require('../database/models');

const requireModerator = checkRole(['moderator', 'admin']);
const requireAdmin = checkRole(['admin']);

// All moderation routes require moderator-level access at minimum
router.use(requireModerator);

// Utility: capture common audit log metadata
const buildAuditMetadata = (req) => ({
    moderatorId: req.user.id,
    moderatorEmail: req.user.email,
    ipAddress: req.ip || req.headers['x-forwarded-for'] || req.connection?.remoteAddress || null,
    userAgent: req.get('user-agent') || null
});

// GET /api/moderation/me - return moderator context & permissions
router.get('/me', (req, res) => {
    res.json({
        id: req.user.id,
        email: req.user.email,
        role: req.user.role,
        permissions: {
            canWarn: true,
            canReviewReports: true,
            canChangeStatus: req.user.role === 'admin',
            canEditRoles: req.user.role === 'admin'
        }
    });
});

// GET /api/moderation/users - list users for moderation view
router.get('/users', async (req, res) => {
    try {
        const { status, search, limit = 25, skip = 0 } = req.query;
        const query = {};

        if (status && ['active', 'suspended', 'banned'].includes(status)) {
            query.accountStatus = status;
        }

        if (search) {
            const regex = new RegExp(search, 'i');
            query.$or = [
                { email: regex },
                { personalName: regex },
                { breederName: regex },
                { id_public: regex }
            ];
        }

        const users = await User.find(query)
            .select('email personalName breederName role accountStatus warningCount id_public createdAt suspensionReason banReason')
            .sort({ createdAt: -1 })
            .skip(parseInt(skip, 10))
            .limit(parseInt(limit, 10))
            .lean();

        const total = await User.countDocuments(query);

        res.json({
            users,
            total,
            limit: parseInt(limit, 10),
            skip: parseInt(skip, 10)
        });
    } catch (error) {
        console.error('Failed to fetch users for moderation:', error);
        res.status(500).json({ message: 'Unable to fetch users.' });
    }
});

// POST /api/moderation/users/:userId/status - admin only status changes
router.post('/users/:userId/status', requireAdmin, async (req, res) => {
    try {
        const { status, reason } = req.body;
        const allowedStatuses = ['active', 'suspended', 'banned'];

        if (!allowedStatuses.includes(status)) {
            return res.status(400).json({ message: 'Invalid account status requested.' });
        }

        const updates = { accountStatus: status };
        const now = new Date();

        if (status === 'active') {
            updates.suspensionReason = null;
            updates.suspensionDate = null;
            updates.banReason = null;
            updates.banDate = null;
        }

        if (status === 'suspended') {
            updates.suspensionReason = reason || 'Suspended by moderator';
            updates.suspensionDate = now;
            updates.banReason = null;
            updates.banDate = null;
        }

        if (status === 'banned') {
            updates.banReason = reason || 'Banned by moderator';
            updates.banDate = now;
        }

        updates.moderatedBy = req.user.id;

        const user = await User.findByIdAndUpdate(req.params.userId, updates, { new: true });
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        await createAuditLog({
            ...buildAuditMetadata(req),
            action: 'user_status_updated',
            targetType: 'user',
            targetId: user._id,
            targetName: `${user.email} (${user.id_public || 'No ID'})`,
            details: { newStatus: status },
            reason: reason || null
        });

        res.json({
            message: `User status updated to ${status}.`,
            user
        });
    } catch (error) {
        console.error('Failed to update user status:', error);
        res.status(500).json({ message: 'Unable to update user status.' });
    }
});

// POST /api/moderation/users/:userId/warn - increment warning count
router.post('/users/:userId/warn', async (req, res) => {
    try {
        const { reason } = req.body;
        const user = await User.findById(req.params.userId);

        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        user.warningCount = (user.warningCount || 0) + 1;
        if (user.warningCount >= 3 && user.accountStatus === 'active') {
            user.accountStatus = 'suspended';
            user.suspensionReason = 'Automatically suspended after 3 warnings.';
            user.suspensionDate = new Date();
        }
        await user.save();

        await createAuditLog({
            ...buildAuditMetadata(req),
            action: 'user_warned',
            targetType: 'user',
            targetId: user._id,
            targetName: `${user.email} (${user.id_public || 'No ID'})`,
            details: { warningCount: user.warningCount },
            reason: reason || null
        });

        res.json({
            message: 'Warning recorded.',
            warningCount: user.warningCount,
            accountStatus: user.accountStatus
        });
    } catch (error) {
        console.error('Failed to warn user:', error);
        res.status(500).json({ message: 'Unable to record warning.' });
    }
});

// Helper to resolve report model details based on type
const reportModelMap = {
    profile: {
        model: ProfileReport,
        populate: [
            { path: 'reporterId', select: 'personalName breederName email id_public' },
            { path: 'reportedUserId', select: 'personalName breederName email id_public' }
        ]
    },
    animal: {
        model: AnimalReport,
        populate: [
            { path: 'reporterId', select: 'personalName breederName email id_public' },
            { path: 'reportedAnimalId', select: 'name id_public ownerId species gender' }
        ]
    },
    message: {
        model: MessageReport,
        populate: [
            { path: 'reporterId', select: 'personalName breederName email id_public' },
            { path: 'reportedUserId', select: 'personalName breederName email id_public' }
        ]
    }
};

// GET /api/moderation/reports - list reports by type
router.get('/reports', async (req, res) => {
    try {
        const { type = 'profile', status, limit = 25, skip = 0 } = req.query;
        const config = reportModelMap[type];

        if (!config) {
            return res.status(400).json({ message: 'Invalid report type.' });
        }

        const filter = {};
        if (status) {
            filter.status = status;
        }

        const query = config.model.find(filter)
            .sort({ createdAt: -1 })
            .skip(parseInt(skip, 10))
            .limit(parseInt(limit, 10));

        config.populate.forEach((pop) => query.populate(pop));

        const reports = await query.lean();
        const total = await config.model.countDocuments(filter);

        res.json({
            reports,
            total,
            limit: parseInt(limit, 10),
            skip: parseInt(skip, 10)
        });
    } catch (error) {
        console.error('Failed to fetch reports:', error);
        res.status(500).json({ message: 'Unable to fetch reports.' });
    }
});

// POST /api/moderation/reports/:type/:reportId/status - update report status/notes
router.post('/reports/:type/:reportId/status', async (req, res) => {
    try {
        const { type, reportId } = req.params;
        const { status, adminNotes } = req.body;
        const config = reportModelMap[type];

        if (!config) {
            return res.status(400).json({ message: 'Invalid report type.' });
        }

        const allowedStatuses = ['pending', 'reviewed', 'resolved', 'dismissed'];
        if (status && !allowedStatuses.includes(status)) {
            return res.status(400).json({ message: 'Invalid report status.' });
        }

        const report = await config.model.findById(reportId);
        if (!report) {
            return res.status(404).json({ message: 'Report not found.' });
        }

        if (status) {
            report.status = status;
        }
        if (adminNotes !== undefined) {
            report.adminNotes = adminNotes;
        }
        report.reviewedBy = req.user.id;
        report.reviewedAt = new Date();
        await report.save();

        await createAuditLog({
            ...buildAuditMetadata(req),
            action: 'report_status_updated',
            targetType: `${type}_report`,
            targetId: report._id,
            targetName: `${type} report ${report._id}`,
            details: { status: report.status }
        });

        res.json({
            message: 'Report updated.',
            report
        });
    } catch (error) {
        console.error('Failed to update report:', error);
        res.status(500).json({ message: 'Unable to update report.' });
    }
});

// PATCH /api/moderation/content/:contentType/:contentId/edit - Edit/redact content fields
router.patch('/content/:contentType/:contentId/edit', async (req, res) => {
    try {
        const { contentType, contentId } = req.params;
        const { fieldEdits, reason } = req.body;

        if (!fieldEdits || typeof fieldEdits !== 'object') {
            return res.status(400).json({ message: 'fieldEdits object is required' });
        }

        const { Animal, PublicProfile, PublicAnimal } = require('../database/models');
        let updated = null;
        let targetName = '';

        if (contentType === 'profile') {
            // Update profile fields
            const user = await User.findByIdAndUpdate(
                contentId,
                fieldEdits,
                { new: true, runValidators: true }
            );
            
            if (!user) {
                return res.status(404).json({ message: 'Profile not found' });
            }

            // Also update public profile if exists
            await PublicProfile.findOneAndUpdate(
                { userId_backend: contentId },
                fieldEdits,
                { runValidators: true }
            );

            updated = user;
            targetName = `${user.email || user.personalName} (${user.id_public || 'No ID'})`;
        } 
        else if (contentType === 'animal') {
            // Update animal fields
            const animal = await Animal.findByIdAndUpdate(
                contentId,
                fieldEdits,
                { new: true, runValidators: true }
            );

            if (!animal) {
                return res.status(404).json({ message: 'Animal not found' });
            }

            // Also update public animal if exists
            await PublicAnimal.findOneAndUpdate(
                { id_public: animal.id_public },
                fieldEdits,
                { runValidators: true }
            );

            updated = animal;
            targetName = `${animal.name} (${animal.id_public || 'No ID'})`;
        }
        else {
            return res.status(400).json({ message: 'Invalid content type. Must be profile or animal' });
        }

        // Create audit log
        await createAuditLog({
            ...buildAuditMetadata(req),
            action: 'content_edited',
            targetType: contentType,
            targetId: contentId,
            targetName,
            details: { 
                fieldsEdited: Object.keys(fieldEdits),
                changes: fieldEdits
            },
            reason: reason || 'Content moderation edit'
        });

        res.json({
            message: 'Content updated successfully',
            updated
        });
    } catch (error) {
        console.error('Failed to edit content:', error);
        res.status(500).json({ message: 'Unable to edit content', error: error.message });
    }
});

// GET /api/moderation/audit-logs - admins only
router.get('/audit-logs', requireAdmin, async (req, res) => {
    try {
        const {
            moderatorId,
            action,
            targetType,
            targetId,
            startDate,
            endDate,
            limit = 50,
            skip = 0
        } = req.query;

        const filters = {};
        if (moderatorId) filters.moderatorId = moderatorId;
        if (action) filters.action = action;
        if (targetType) filters.targetType = targetType;
        if (targetId) filters.targetId = targetId;
        if (startDate) filters.startDate = startDate;
        if (endDate) filters.endDate = endDate;

        const auditData = await getAuditLogs(filters, {
            limit: Number(limit) || 50,
            skip: Number(skip) || 0,
            sort: '-createdAt'
        });

        res.json(auditData);
    } catch (error) {
        console.error('Failed to fetch audit logs:', error);
        res.status(500).json({ message: 'Unable to fetch audit logs.' });
    }
});

module.exports = router;
