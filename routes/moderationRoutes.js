const express = require('express');
const router = express.Router();
const { checkRole } = require('../middleware/authMiddleware');
const { validateModerationInput } = require('../middleware/validationMiddleware');
const { createAuditLog, getAuditLogs, logFailedAction, categorizeError } = require('../utils/auditLogger');
const {
    User,
    ProfileReport,
    AnimalReport,
    MessageReport,
    Animal,
    PublicProfile,
    PublicAnimal,
    Notification,
    AuditLog
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

// GET /api/moderation/debug/reports-count - diagnostic endpoint to check if any reports exist
router.get('/debug/reports-count', async (req, res) => {
    try {
        const profileCount = await ProfileReport.countDocuments();
        const animalCount = await AnimalReport.countDocuments();
        const messageCount = await MessageReport.countDocuments();

        console.log('[MODERATION DEBUG] Report counts:', { profileCount, animalCount, messageCount });

        res.json({
            profileReports: profileCount,
            animalReports: animalCount,
            messageReports: messageCount,
            total: profileCount + animalCount + messageCount
        });
    } catch (error) {
        console.error('[MODERATION DEBUG] Error getting report counts:', error);
        res.status(500).json({ message: 'Failed to get report counts' });
    }
});

// GET /api/moderation/users - list users for moderation view
router.get('/users', async (req, res) => {
    try {
        const { status, search, limit = 25, skip = 0 } = req.query;
        const query = {};

        if (status && ['normal', 'suspended', 'banned'].includes(status)) {
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

// POST /api/moderation/users/:userId/status - moderator and admin status changes
router.post('/users/:userId/status', requireModerator, validateModerationInput, async (req, res) => {
    try {
        const { status, reason, durationDays, ipBan } = req.body;
        let userId = req.params.userId;
        const allowedStatuses = ['normal', 'suspended', 'banned'];

        console.log('[MODERATION STATUS] Updating user status:', { userId, status, reason, durationDays, ipBan });

        if (!allowedStatuses.includes(status)) {
            return res.status(400).json({ message: 'Invalid account status requested.' });
        }

        const updates = { accountStatus: status };
        const now = new Date();

        if (status === 'normal') {
            updates.suspensionReason = null;
            updates.suspensionDate = null;
            updates.suspensionExpiry = null;
            updates.suspensionLiftedDate = now; // Set when suspension is lifted
            updates.banReason = null;
            updates.banDate = null;
            updates.banType = null;
            updates.bannedIP = null;
        }

        if (status === 'suspended') {
            updates.suspensionReason = reason || 'Suspended by moderator';
            updates.suspensionDate = now;
            updates.banReason = null;
            updates.banDate = null;
            if (durationDays) {
                const expiryDate = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);
                updates.suspensionExpiry = expiryDate;
                console.log('[MODERATION STATUS] Suspension calculation:', {
                    durationDays,
                    now: now.toISOString(),
                    suspensionExpiry: expiryDate.toISOString(),
                    expiryTimestamp: expiryDate.getTime()
                });
            } else {
                console.log('[MODERATION STATUS] WARNING: No durationDays provided, suspension has no expiry!');
            }
        }

        if (status === 'banned') {
            updates.banReason = reason || 'Banned by moderator';
            updates.banDate = now;
            updates.banType = ipBan ? 'ip-ban' : 'banned';
            if (ipBan) {
                // Get the target user's actual IP for IP banning
                // First, try to get from lastLoginIP if available, otherwise use a placeholder
                // The actual IP should be captured from their login history
                const targetUser = await User.findById(userId) || await User.findOne({ id_public: userId });
                let targetIP = targetUser?.lastLoginIP;
                
                if (!targetIP) {
                    // If we don't have their last login IP, log warning and don't set IP ban
                    console.warn('[MODERATION STATUS] WARNING: No last login IP found for user. IP ban will not be enforceable until they log in next time.');
                    // We'll capture their IP on next login attempt
                    targetIP = 'pending-capture-on-next-login';
                }
                
                updates.bannedIP = targetIP;
                console.log('[MODERATION STATUS] IP ban requested:', { targetIP, targetUser: targetUser?.email });
            }
        }

        updates.moderatedBy = req.user.id;

        // Try to find and update user - first try as MongoDB ID, then try as id_public
        let user = await User.findByIdAndUpdate(userId, updates, { new: true });
        
        if (!user) {
            // Try finding by id_public (public ID like "CTU8")
            user = await User.findOneAndUpdate({ id_public: userId }, updates, { new: true });
        }

        if (!user) {
            console.log('[MODERATION STATUS] User not found:', userId);
            return res.status(404).json({ message: 'User not found.' });
        }

        console.log('[MODERATION STATUS] User status updated successfully:', { 
            email: user.email, 
            newStatus: status 
        });

        await createAuditLog({
            ...buildAuditMetadata(req),
            action: 'user_status_updated',
            targetType: 'user',
            targetId: user._id,
            targetName: `${user.email} (${user.id_public || 'No ID'})`,
            details: { newStatus: status, durationDays, ipBan },
            reason: reason || null
        });

        // Check if this is lifting a suspension (changing from suspended to active)
        const wasLiftingSuspension = status === 'normal' && updates.suspensionReason === null;

        res.json({
            message: `User status updated to ${status}.`,
            user,
            suspensionLifted: wasLiftingSuspension
        });
    } catch (error) {
        console.error('[MODERATION STATUS] Failed to update user status:', error);
        
        // Log the failed action
        await logFailedAction({
            ...buildAuditMetadata(req),
            attemptedAction: 'user_status_update',
            targetType: 'user',
            targetId: req.params.userId,
            details: { attemptedStatus: req.body.status, durationDays: req.body.durationDays },
            reason: req.body.reason,
            error
        });
        
        const { code, userMessage, isRetryable } = categorizeError(error);
        res.status(500).json({ 
            message: userMessage,
            errorCode: code,
            isRetryable,
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// GET /api/moderation/users/:userId/info - get user's warning and status info (moderator view)
router.get('/users/:userId/info', requireModerator, async (req, res) => {
    try {
        let userId = req.params.userId;
        
        // Try to find user - first try as MongoDB ID, then try as id_public
        let user = await User.findById(userId);
        
        if (!user) {
            // Try finding by id_public (public ID like "CTU8")
            user = await User.findOne({ id_public: userId });
        }

        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        // Return user info from moderator perspective
        res.json({
            id_public: user.id_public,
            email: user.email,
            personalName: user.personalName,
            breederName: user.breederName,
            warningCount: user.warningCount || 0,
            warnings: user.warnings || [],
            accountStatus: user.accountStatus || 'normal',
            suspensionReason: user.suspensionReason,
            suspensionDate: user.suspensionDate,
            banReason: user.banReason,
            banDate: user.banDate
        });
    } catch (error) {
        console.error('[MODERATION INFO] Failed to get user info:', error);
        res.status(500).json({ message: 'Unable to fetch user info.' });
    }
});

// POST /api/moderation/users/:userId/warn - add individual warning record
router.post('/users/:userId/warn', requireModerator, validateModerationInput, async (req, res) => {
    try {
        const { reason, category } = req.body;
        let userId = req.params.userId;
        
        console.log('[MODERATION WARN] Warning user:', { userId, reason, category });

        // Try to find user - first try as MongoDB ID, then try as id_public
        let user = await User.findById(userId);
        
        if (!user) {
            // Try finding by id_public (public ID like "CTU8")
            user = await User.findOne({ id_public: userId });
        }

        if (!user) {
            console.log('[MODERATION WARN] User not found:', userId);
            return res.status(404).json({ message: 'User not found.' });
        }

        // Add new warning record to warnings array
        const newWarning = {
            date: new Date(),
            reason: reason || 'No reason specified',
            category: category || 'general',
            moderatorId: req.user.id,
            isLifted: false
        };
        
        if (!user.warnings) {
            user.warnings = [];
        }
        user.warnings.push(newWarning);
        
        // Update warningCount to match active (non-lifted) warnings
        user.warningCount = user.warnings.filter(w => !w.isLifted).length;

        // Auto-suspend at 3 active warnings
        if (user.warningCount >= 3 && user.accountStatus === 'normal') {
            user.accountStatus = 'suspended';
            user.suspensionReason = 'Automatically suspended after 3 warnings.';
            user.suspensionDate = new Date();
        }
        await user.save();

        console.log('[MODERATION WARN] User warned successfully:', { 
            email: user.email, 
            warningCount: user.warningCount, 
            newStatus: user.accountStatus 
        });

        await createAuditLog({
            ...buildAuditMetadata(req),
            action: 'user_warned',
            targetType: 'user',
            targetId: user._id,
            targetName: `${user.email} (${user.id_public || 'No ID'})`,
            details: { warningCount: user.warningCount, reason: reason || null },
            reason: reason || null
        });

        res.json({
            message: 'Warning recorded.',
            warningCount: user.warningCount,
            warnings: user.warnings.filter(w => !w.isLifted),
            accountStatus: user.accountStatus
        });
    } catch (error) {
        console.error('[MODERATION WARN] Failed to warn user:', error);
        
        // Log the failed action
        await logFailedAction({
            ...buildAuditMetadata(req),
            attemptedAction: 'user_warn',
            targetType: 'user',
            targetId: req.params.userId,
            details: { category: req.body.category },
            reason: req.body.reason,
            error
        });
        
        const { code, userMessage, isRetryable } = categorizeError(error);
        res.status(500).json({ 
            message: userMessage,
            errorCode: code,
            isRetryable,
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// POST /api/moderation/users/:userId/lift-warning - mark specific warning as lifted
router.post('/users/:userId/lift-warning', requireModerator, validateModerationInput, async (req, res) => {
    try {
        const { reason, warningIndex } = req.body;
        let userId = req.params.userId;
        
        console.log('[MODERATION LIFT_WARNING] Lifting warning for user:', { userId, reason, warningIndex });

        // Try to find user - first try as MongoDB ID, then try as id_public
        let user = await User.findById(userId);
        
        if (!user) {
            // Try finding by id_public (public ID like "CTU8")
            user = await User.findOne({ id_public: userId });
        }

        if (!user) {
            console.log('[MODERATION LIFT_WARNING] User not found:', userId);
            return res.status(404).json({ message: 'User not found.' });
        }

        // Validate user has warnings
        if (!user.warnings || user.warnings.length === 0) {
            return res.status(400).json({ message: 'User has no warnings to lift.' });
        }

        // If warningIndex is provided, lift that specific warning
        // Otherwise, lift the oldest active warning (backward compatibility)
        let warningToLift = null;
        
        if (warningIndex !== undefined && warningIndex !== null) {
            // Lift specific warning by index
            if (warningIndex < 0 || warningIndex >= user.warnings.length) {
                return res.status(400).json({ message: 'Invalid warning index.' });
            }
            warningToLift = user.warnings[warningIndex];
        } else {
            // Lift oldest active warning (default behavior)
            warningToLift = user.warnings.find(w => !w.isLifted);
        }

        if (!warningToLift) {
            return res.status(400).json({ message: 'Warning already lifted or not found.' });
        }

        warningToLift.isLifted = true;
        
        // Update warningCount to match active (non-lifted) warnings
        user.warningCount = user.warnings.filter(w => !w.isLifted).length;
        
        await user.save();

        console.log('[MODERATION LIFT_WARNING] Warning lifted successfully:', { 
            email: user.email, 
            warningCount: user.warningCount
        });

        await createAuditLog({
            ...buildAuditMetadata(req),
            action: 'warning_lifted',
            targetType: 'user',
            targetId: user._id,
            targetName: `${user.email} (${user.id_public || 'No ID'})`,
            details: { warningCount: user.warningCount, warningIndex: warningIndex },
            reason: reason || null
        });

        res.json({
            message: 'Warning lifted.',
            warningCount: user.warningCount,
            warnings: user.warnings,
            accountStatus: user.accountStatus
        });
    } catch (error) {
        console.error('[MODERATION LIFT_WARNING] Failed to lift warning:', error);
        
        // Log the failed action
        await logFailedAction({
            ...buildAuditMetadata(req),
            attemptedAction: 'warning_lift',
            targetType: 'user',
            targetId: req.params.userId,
            details: { warningIndex: req.body.warningIndex },
            reason: req.body.reason,
            error
        });
        
        const { code, userMessage, isRetryable } = categorizeError(error);
        res.status(500).json({ 
            message: userMessage,
            errorCode: code,
            isRetryable,
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Helper to resolve report model details based on type
const reportModelMap = {
    profile: {
        model: ProfileReport,
        populate: [
            { path: 'reporterId', select: 'personalName breederName email id_public' },
            { path: 'reportedUserId', select: 'personalName breederName email id_public profileImage bio websiteUrl showPersonalName showBreederName' },
            { path: 'assignedTo', select: 'personalName breederName email id_public' },
            { path: 'assignedBy', select: 'personalName breederName email id_public' }
        ]
    },
    animal: {
        model: AnimalReport,
        populate: [
            { path: 'reporterId', select: 'personalName breederName email id_public' },
            { 
                path: 'reportedAnimalId', 
                select: 'name id_public ownerId species gender imageUrl prefix suffix breederyId remarks geneticCode color coat coatPattern earset breed strain microchipNumber pedigreeRegistrationId fertilityNotes damFertilityNotes temperament causeOfDeath necropsyResults birthDate status',
                populate: {
                    path: 'ownerId',
                    select: 'personalName breederName email id_public profileImage'
                }
            },
            { path: 'assignedTo', select: 'personalName breederName email id_public' },
            { path: 'assignedBy', select: 'personalName breederName email id_public' }
        ]
    },
    message: {
        model: MessageReport,
        populate: [
            { path: 'reporterId', select: 'personalName breederName email id_public' },
            { path: 'reportedUserId', select: 'personalName breederName email id_public profileImage' },
            { path: 'messageId', select: 'message senderId receiverId createdAt' },
            { path: 'assignedTo', select: 'personalName breederName email id_public' },
            { path: 'assignedBy', select: 'personalName breederName email id_public' }
        ]
    }
};

// GET /api/moderation/reports - list reports by type
router.get('/reports', async (req, res) => {
    try {
        const { type = 'profile', status, limit = 25, skip = 0 } = req.query;
        const config = reportModelMap[type];

        console.log('[MODERATION REPORTS] Fetching reports with params:', { type, status, limit, skip });

        if (!config) {
            console.log('[MODERATION REPORTS] Invalid report type:', type);
            return res.status(400).json({ message: 'Invalid report type.' });
        }

        const filter = {};
        if (status) {
            filter.status = status;
        }

        console.log('[MODERATION REPORTS] Using filter:', filter);

        const query = config.model.find(filter)
            .sort({ createdAt: -1 })
            .skip(parseInt(skip, 10))
            .limit(parseInt(limit, 10));

        config.populate.forEach((pop) => query.populate(pop));

        const reports = await query.lean();
        const total = await config.model.countDocuments(filter);

        console.log(`[MODERATION REPORTS] Found ${reports.length} ${type} reports (total: ${total})`);
        console.log('[MODERATION REPORTS] First report sample:', reports[0] || 'No reports');

        res.json({
            reports,
            total,
            limit: parseInt(limit, 10),
            skip: parseInt(skip, 10)
        });
    } catch (error) {
        console.error('[MODERATION REPORTS] Error fetching reports:', error);
        res.status(500).json({ message: 'Unable to fetch reports.' });
    }
});

// POST /api/moderation/reports/:type/:reportId/status - update report status/notes
router.post('/reports/:type/:reportId/status', requireModerator, validateModerationInput, async (req, res) => {
    try {
        const { type, reportId } = req.params;
        const { status, adminNotes } = req.body;
        const config = reportModelMap[type];

        if (!config) {
            return res.status(400).json({ message: 'Invalid report type.' });
        }

        const allowedStatuses = ['pending', 'in_progress', 'reviewed', 'resolved', 'dismissed'];
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
        
        // Log the failed action
        await logFailedAction({
            ...buildAuditMetadata(req),
            attemptedAction: 'report_status_update',
            targetType: `${req.params.type}_report`,
            targetId: req.params.reportId,
            details: { attemptedStatus: req.body.status },
            error
        });
        
        const { code, userMessage, isRetryable } = categorizeError(error);
        res.status(500).json({ 
            message: userMessage,
            errorCode: code,
            isRetryable,
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// POST /api/moderation/reports/:type/:reportId/assign - Assign report to a moderator
router.post('/reports/:type/:reportId/assign', requireModerator, async (req, res) => {
    try {
        const { type, reportId } = req.params;
        const { moderatorId } = req.body; // null to unassign
        const config = reportModelMap[type];

        if (!config) {
            return res.status(400).json({ message: 'Invalid report type.' });
        }

        const report = await config.model.findById(reportId);
        if (!report) {
            return res.status(404).json({ message: 'Report not found.' });
        }

        // If moderatorId provided, verify the user exists and is a moderator
        let assignedModerator = null;
        if (moderatorId) {
            assignedModerator = await User.findById(moderatorId);
            if (!assignedModerator) {
                return res.status(404).json({ message: 'Moderator not found.' });
            }
            if (!['moderator', 'admin'].includes(assignedModerator.role)) {
                return res.status(400).json({ message: 'User is not a moderator.' });
            }
        }

        const previousAssignment = report.assignedTo;
        
        // Update assignment
        report.assignedTo = moderatorId || null;
        report.assignedBy = moderatorId ? req.user.id : null;
        report.assignedAt = moderatorId ? new Date() : null;
        
        // Auto-set status to in_progress when assigned (if currently pending)
        if (moderatorId && report.status === 'pending') {
            report.status = 'in_progress';
        }
        // Reset to pending if unassigned and was in_progress
        if (!moderatorId && report.status === 'in_progress') {
            report.status = 'pending';
        }

        await report.save();

        // Populate for response
        await report.populate(config.populate);

        await createAuditLog({
            ...buildAuditMetadata(req),
            action: moderatorId ? 'report_assigned' : 'report_unassigned',
            targetType: `${type}_report`,
            targetId: report._id,
            targetName: `${type} report ${report._id}`,
            details: {
                assignedTo: assignedModerator ? {
                    id: assignedModerator._id,
                    name: assignedModerator.breederName || assignedModerator.personalName || assignedModerator.email
                } : null,
                previousAssignment: previousAssignment || null,
                newStatus: report.status
            }
        });

        res.json({
            message: moderatorId ? 'Report assigned successfully.' : 'Report unassigned.',
            report
        });
    } catch (error) {
        console.error('Failed to assign report:', error);
        
        await logFailedAction({
            ...buildAuditMetadata(req),
            attemptedAction: 'report_assignment',
            targetType: `${req.params.type}_report`,
            targetId: req.params.reportId,
            details: { attemptedAssignment: req.body.moderatorId },
            error
        });
        
        const { code, userMessage, isRetryable } = categorizeError(error);
        res.status(500).json({ 
            message: userMessage,
            errorCode: code,
            isRetryable,
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// POST /api/moderation/reports/:type/:reportId/claim - Moderator claims a report for themselves
router.post('/reports/:type/:reportId/claim', requireModerator, async (req, res) => {
    try {
        const { type, reportId } = req.params;
        const config = reportModelMap[type];

        if (!config) {
            return res.status(400).json({ message: 'Invalid report type.' });
        }

        const report = await config.model.findById(reportId);
        if (!report) {
            return res.status(404).json({ message: 'Report not found.' });
        }

        // Check if already assigned to someone else
        if (report.assignedTo && report.assignedTo.toString() !== req.user.id) {
            const assignee = await User.findById(report.assignedTo).select('personalName breederName email');
            return res.status(409).json({ 
                message: 'Report is already assigned to another moderator.',
                assignedTo: assignee ? {
                    name: assignee.breederName || assignee.personalName || assignee.email
                } : null
            });
        }

        // Claim the report
        report.assignedTo = req.user.id;
        report.assignedBy = req.user.id;
        report.assignedAt = new Date();
        
        if (report.status === 'pending') {
            report.status = 'in_progress';
        }

        await report.save();
        await report.populate(config.populate);

        await createAuditLog({
            ...buildAuditMetadata(req),
            action: 'report_claimed',
            targetType: `${type}_report`,
            targetId: report._id,
            targetName: `${type} report ${report._id}`,
            details: { newStatus: report.status }
        });

        res.json({
            message: 'Report claimed successfully.',
            report
        });
    } catch (error) {
        console.error('Failed to claim report:', error);
        
        await logFailedAction({
            ...buildAuditMetadata(req),
            attemptedAction: 'report_claim',
            targetType: `${req.params.type}_report`,
            targetId: req.params.reportId,
            error
        });
        
        const { code, userMessage, isRetryable } = categorizeError(error);
        res.status(500).json({ 
            message: userMessage,
            errorCode: code,
            isRetryable,
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// GET /api/moderation/moderators/workload - Get moderator workload stats
router.get('/moderators/workload', requireModerator, async (req, res) => {
    try {
        // Get all moderators
        const moderators = await User.find({ 
            role: { $in: ['moderator', 'admin'] } 
        }).select('personalName breederName email role id_public');

        // Get assignment counts per moderator
        const workloadStats = await Promise.all(moderators.map(async (mod) => {
            const [profileCount, animalCount, messageCount] = await Promise.all([
                ProfileReport.countDocuments({ assignedTo: mod._id, status: { $in: ['pending', 'in_progress'] } }),
                AnimalReport.countDocuments({ assignedTo: mod._id, status: { $in: ['pending', 'in_progress'] } }),
                MessageReport.countDocuments({ assignedTo: mod._id, status: { $in: ['pending', 'in_progress'] } })
            ]);

            return {
                moderator: {
                    _id: mod._id,
                    id_public: mod.id_public,
                    name: mod.breederName || mod.personalName || mod.email,
                    email: mod.email,
                    role: mod.role
                },
                assignedReports: {
                    profile: profileCount,
                    animal: animalCount,
                    message: messageCount,
                    total: profileCount + animalCount + messageCount
                }
            };
        }));

        // Also get unassigned report counts
        const [unassignedProfile, unassignedAnimal, unassignedMessage] = await Promise.all([
            ProfileReport.countDocuments({ assignedTo: null, status: 'pending' }),
            AnimalReport.countDocuments({ assignedTo: null, status: 'pending' }),
            MessageReport.countDocuments({ assignedTo: null, status: 'pending' })
        ]);

        res.json({
            moderators: workloadStats,
            unassigned: {
                profile: unassignedProfile,
                animal: unassignedAnimal,
                message: unassignedMessage,
                total: unassignedProfile + unassignedAnimal + unassignedMessage
            }
        });
    } catch (error) {
        console.error('Failed to fetch moderator workload:', error);
        
        await logFailedAction({
            ...buildAuditMetadata(req),
            attemptedAction: 'get_moderator_workload',
            targetType: 'system',
            error
        });
        
        const { code, userMessage, isRetryable } = categorizeError(error);
        res.status(500).json({ 
            message: userMessage,
            errorCode: code,
            isRetryable,
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// DELETE /api/moderation/users/:userId/image - Remove user profile image
router.delete('/users/:userId/image', async (req, res) => {
    try {
        const { userId } = req.params;
        const { reason } = req.body;

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const oldImage = user.profileImage;

        // Remove from User and PublicProfile
        await User.findByIdAndUpdate(userId, { profileImage: null });
        await require('../database/models').PublicProfile.findOneAndUpdate(
            { userId_backend: userId },
            { profileImage: null }
        );

        await createAuditLog({
            ...buildAuditMetadata(req),
            action: 'profile_image_removed',
            targetType: 'user',
            targetId: userId,
            targetName: `${user.email} (${user.id_public || 'No ID'})`,
            details: { oldImage },
            reason: reason || 'Image removed by moderator'
        });

        res.json({
            message: 'Profile image removed successfully'
        });
    } catch (error) {
        console.error('Failed to remove profile image:', error);
        
        // Log the failed action
        await logFailedAction({
            ...buildAuditMetadata(req),
            attemptedAction: 'profile_image_remove',
            targetType: 'user',
            targetId: req.params.userId,
            reason: req.body.reason,
            error
        });
        
        const { code, userMessage, isRetryable } = categorizeError(error);
        res.status(500).json({ 
            message: userMessage,
            errorCode: code,
            isRetryable,
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// DELETE /api/moderation/animals/:animalId/image - Remove animal image
router.delete('/animals/:animalId/image', async (req, res) => {
    try {
        const { animalId } = req.params;
        const { reason } = req.body;

        const { Animal, PublicAnimal } = require('../database/models');
        
        const animal = await Animal.findById(animalId);
        if (!animal) {
            return res.status(404).json({ message: 'Animal not found' });
        }

        const oldImageUrl = animal.imageUrl;
        const oldPhotoUrl = animal.photoUrl;

        // Remove both imageUrl and photoUrl
        await Animal.findByIdAndUpdate(animalId, { 
            imageUrl: null,
            photoUrl: null 
        });
        
        await PublicAnimal.findOneAndUpdate(
            { id_public: animal.id_public },
            { 
                imageUrl: null,
                photoUrl: null 
            }
        );

        await createAuditLog({
            ...buildAuditMetadata(req),
            action: 'animal_image_removed',
            targetType: 'animal',
            targetId: animalId,
            targetName: `${animal.name} (${animal.id_public || 'No ID'})`,
            details: { oldImageUrl, oldPhotoUrl },
            reason: reason || 'Image removed by moderator'
        });

        res.json({
            message: 'Animal image removed successfully'
        });
    } catch (error) {
        console.error('Failed to remove animal image:', error);
        
        // Log the failed action
        await logFailedAction({
            ...buildAuditMetadata(req),
            attemptedAction: 'animal_image_remove',
            targetType: 'animal',
            targetId: req.params.animalId,
            reason: req.body.reason,
            error
        });
        
        const { code, userMessage, isRetryable } = categorizeError(error);
        res.status(500).json({ 
            message: userMessage,
            errorCode: code,
            isRetryable,
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// PATCH /api/moderation/content/:contentType/:contentId/edit - Edit/redact content fields
router.patch('/content/:contentType/:contentId/edit', requireModerator, validateModerationInput, async (req, res) => {
    try {
        const { contentType, contentId } = req.params;
        const { fieldEdits, reason } = req.body;

        console.log('[MODERATION EDIT] Editing content:', { contentType, contentId, fieldEdits, reason });

        if (!fieldEdits || typeof fieldEdits !== 'object') {
            return res.status(400).json({ message: 'fieldEdits object is required' });
        }

        let updated = null;
        let targetName = '';
        const mongoose = require('mongoose');
        const isObjectId = mongoose.Types.ObjectId.isValid(contentId);

        if (contentType === 'profile') {
            // Process field edits - convert empty strings to null for clearing fields
            const processedEdits = { ...fieldEdits };
            for (const key of Object.keys(processedEdits)) {
                if (processedEdits[key] === '' || processedEdits[key] === undefined) {
                    processedEdits[key] = null;
                }
            }

            // Try to find by ObjectId first, then by public ID
            let user = null;
            
            if (isObjectId) {
                user = await User.findByIdAndUpdate(
                    contentId,
                    processedEdits,
                    { new: true, runValidators: true }
                );
            } else {
                // Try by public ID
                user = await User.findOneAndUpdate(
                    { id_public: contentId },
                    processedEdits,
                    { new: true, runValidators: true }
                );
            }
            
            if (!user) {
                console.log('[MODERATION EDIT] Profile not found:', contentId);
                return res.status(404).json({ message: 'Profile not found' });
            }

            // Also update public profile if exists
            await PublicProfile.findOneAndUpdate(
                { userId_backend: user._id },
                processedEdits,
                { runValidators: true }
            );

            updated = user;
            targetName = `${user.email || user.personalName} (${user.id_public || 'No ID'})`;
            console.log('[MODERATION EDIT] Updated profile:', targetName, 'with edits:', processedEdits);
        } 
        else if (contentType === 'animal') {
            // Try to find by ObjectId first, then by public ID
            let animal = null;
            
            if (isObjectId) {
                animal = await Animal.findByIdAndUpdate(
                    contentId,
                    fieldEdits,
                    { new: true, runValidators: true }
                );
            } else {
                // Try by public ID
                animal = await Animal.findOneAndUpdate(
                    { id_public: contentId },
                    fieldEdits,
                    { new: true, runValidators: true }
                );
            }

            if (!animal) {
                console.log('[MODERATION EDIT] Animal not found:', contentId);
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
            console.log('[MODERATION EDIT] Updated animal:', targetName);
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

        // Create notification for the user about the content edit
        try {
            // Determine user to notify
            let notifyUserId = null;
            let notifyUserIdPublic = null;
            
            if (contentType === 'profile') {
                notifyUserId = updated._id;
                notifyUserIdPublic = updated.id_public;
            } else if (contentType === 'animal' && updated.ownerId) {
                // For animals, notify the owner
                const owner = await User.findById(updated.ownerId).select('_id id_public');
                if (owner) {
                    notifyUserId = owner._id;
                    notifyUserIdPublic = owner.id_public;
                }
            }

            if (notifyUserId) {
                // Build a human-readable list of what was changed
                const changedFields = Object.entries(fieldEdits).map(([field, value]) => {
                    const fieldLabel = field.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                    if (value === '' || value === null) {
                        return `${fieldLabel} was removed`;
                    }
                    return `${fieldLabel} was edited`;
                }).join(', ');

                const notificationMessage = contentType === 'profile' 
                    ? `A moderator has edited your profile. Changes: ${changedFields}. Reason: ${reason || 'Content policy violation'}`
                    : `A moderator has edited your animal "${updated.name}". Changes: ${changedFields}. Reason: ${reason || 'Content policy violation'}`;

                await Notification.create({
                    userId: notifyUserId,
                    userId_public: notifyUserIdPublic,
                    type: 'content_edited',
                    message: notificationMessage,
                    metadata: {
                        contentType,
                        contentId: updated._id || contentId,
                        contentIdPublic: updated.id_public,
                        fieldsEdited: Object.keys(fieldEdits),
                        reason: reason || 'Content policy violation'
                    },
                    status: 'pending', // Pending until user acknowledges
                    read: false
                });
                console.log('[MODERATION EDIT] Notification sent to user:', notifyUserIdPublic);
            }
        } catch (notifError) {
            // Don't fail the edit if notification fails
            console.error('[MODERATION EDIT] Failed to send notification:', notifError);
        }

        res.json({
            message: 'Content updated successfully',
            updated
        });
    } catch (error) {
        console.error('[MODERATION EDIT] Failed to edit content:', error);
        
        // Log the failed action
        await logFailedAction({
            ...buildAuditMetadata(req),
            attemptedAction: 'content_edit',
            targetType: req.params.contentType,
            targetId: req.params.contentId,
            details: { fieldsAttempted: Object.keys(req.body.fieldEdits || {}) },
            reason: req.body.reason,
            error
        });
        
        const { code, userMessage, isRetryable } = categorizeError(error);
        res.status(500).json({ 
            message: userMessage,
            errorCode: code,
            isRetryable,
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
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
            skip = 0,
            page = 1,
            sortBy = 'createdAt',
            sortOrder = 'desc',
            failedOnly,
            search
        } = req.query;

        const filters = {};
        if (moderatorId) filters.moderatorId = moderatorId;
        if (action) filters.action = action;
        if (targetType) filters.targetType = targetType;
        if (targetId) filters.targetId = targetId;
        if (startDate) filters.startDate = startDate;
        if (endDate) filters.endDate = endDate;
        if (failedOnly === 'true') filters.failedOnly = true;
        if (search) filters.search = search;

        // Calculate skip from page if page is provided
        const calculatedSkip = page > 1 ? (page - 1) * Number(limit) : Number(skip);

        // Build sort string (prefix with - for descending)
        const sortString = sortOrder === 'asc' ? sortBy : `-${sortBy}`;

        const auditData = await getAuditLogs(filters, {
            limit: Number(limit) || 50,
            skip: calculatedSkip,
            sort: sortString
        });

        res.json(auditData);
    } catch (error) {
        console.error('Failed to fetch audit logs:', error);
        res.status(500).json({ message: 'Unable to fetch audit logs.' });
    }
});

// POST /api/moderation/broadcast - Send system-wide broadcast message (Admin only)
router.post('/broadcast', requireAdmin, validateModerationInput, async (req, res) => {
    try {
        const { title, message, type, scheduledFor } = req.body;

        // Validate input
        if (!title || !message) {
            return res.status(400).json({ error: 'Title and message are required' });
        }

        const validTypes = ['info', 'warning', 'alert', 'announcement'];
        if (type && !validTypes.includes(type)) {
            return res.status(400).json({ error: `Invalid type. Must be one of: ${validTypes.join(', ')}` });
        }

        // Validate scheduled time if provided
        let sendAt = new Date();
        if (scheduledFor) {
            sendAt = new Date(scheduledFor);
            if (sendAt < new Date()) {
                return res.status(400).json({ error: 'Scheduled time must be in the future' });
            }
        }

        // Get all users
        const allUsers = await User.find({}).select('_id email accountStatus').lean();
        
        // Filter out banned/suspended users unless it's an alert for them
        const activeUsers = allUsers.filter(u => u.accountStatus === 'normal');

        // Create notifications for each user
        const notificationDocs = activeUsers.map(user => ({
            userId: user._id,
            type: 'broadcast',
            title: title,
            message: message,
            broadcastType: type || 'info',
            isRead: false,
            createdAt: sendAt,
            sendAt: sendAt,
            isPending: sendAt > new Date() // Mark as pending if scheduled
        }));

        // Bulk insert notifications
        await Notification.insertMany(notificationDocs);

        // Log broadcast action
        await createAuditLog({
            moderatorId: req.user.id,
            moderatorEmail: req.user.email,
            action: 'broadcast_sent',
            targetType: 'system',
            targetId: null,
            details: {
                title: title,
                recipientCount: activeUsers.length,
                type: type || 'info',
                scheduled: sendAt > new Date(),
                scheduledFor: sendAt.toISOString()
            },
            reason: `Broadcast: ${title}`,
            ipAddress: req.ip || req.connection?.remoteAddress,
            userAgent: req.get('user-agent')
        });

        console.log(`[BROADCAST] Admin ${req.user.email} sent broadcast to ${activeUsers.length} users`);

        res.status(200).json({
            success: true,
            message: scheduledFor ? `Broadcast scheduled for ${new Date(scheduledFor).toLocaleString()}` : 'Broadcast sent to all users',
            recipientCount: activeUsers.length,
            scheduledFor: scheduledFor ? new Date(scheduledFor).toISOString() : null
        });
    } catch (error) {
        console.error('Failed to send broadcast:', error);
        
        // Log the failed action
        await logFailedAction({
            ...buildAuditMetadata(req),
            attemptedAction: 'broadcast_send',
            targetType: 'system',
            details: { title: req.body.title, type: req.body.type },
            error
        });
        
        const { code, userMessage, isRetryable } = categorizeError(error);
        res.status(500).json({ 
            error: userMessage,
            errorCode: code,
            isRetryable,
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// GET /api/moderation/broadcasts - Get broadcast history (Admin only)
router.get('/broadcasts', requireAdmin, async (req, res) => {
    try {
        const { limit = 50, skip = 0 } = req.query;

        // Query audit logs for broadcasts
        const broadcasts = await AuditLog.find({ action: 'broadcast_sent' })
            .populate('moderatorId', 'email personalName id_public')
            .sort('-createdAt')
            .limit(parseInt(limit))
            .skip(parseInt(skip))
            .lean();

        const total = await AuditLog.countDocuments({ action: 'broadcast_sent' });

        res.json({
            broadcasts,
            total,
            limit: parseInt(limit),
            skip: parseInt(skip)
        });
    } catch (error) {
        console.error('Failed to fetch broadcasts:', error);
        res.status(500).json({ error: 'Failed to fetch broadcast history' });
    }
});

module.exports = router;
