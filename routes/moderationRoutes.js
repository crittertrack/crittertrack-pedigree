const express = require('express');
const router = express.Router();
const { checkRole } = require('../middleware/authMiddleware');
const { createAuditLog, getAuditLogs } = require('../utils/auditLogger');
const {
    User,
    ProfileReport,
    AnimalReport,
    MessageReport,
    Animal,
    PublicProfile,
    PublicAnimal,
    Notification
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

// POST /api/moderation/users/:userId/status - moderator and admin status changes
router.post('/users/:userId/status', requireModerator, async (req, res) => {
    try {
        const { status, reason, durationDays, ipBan } = req.body;
        let userId = req.params.userId;
        const allowedStatuses = ['active', 'suspended', 'banned'];

        console.log('[MODERATION STATUS] Updating user status:', { userId, status, reason, durationDays, ipBan });

        if (!allowedStatuses.includes(status)) {
            return res.status(400).json({ message: 'Invalid account status requested.' });
        }

        const updates = { accountStatus: status };
        const now = new Date();

        if (status === 'active') {
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
                // Store the IP for blocking future registrations
                const userIP = req.ip || req.connection.remoteAddress || req.socket.remoteAddress;
                updates.bannedIP = userIP;
                console.log('[MODERATION STATUS] IP ban requested:', { userIP });
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
        const wasLiftingSuspension = status === 'active' && updates.suspensionReason === null;

        res.json({
            message: `User status updated to ${status}.`,
            user,
            suspensionLifted: wasLiftingSuspension
        });
    } catch (error) {
        console.error('[MODERATION STATUS] Failed to update user status:', error);
        res.status(500).json({ message: 'Unable to update user status.' });
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
            accountStatus: user.accountStatus || 'active',
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
router.post('/users/:userId/warn', async (req, res) => {
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
        if (user.warningCount >= 3 && user.accountStatus === 'active') {
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
        res.status(500).json({ message: 'Unable to record warning.' });
    }
});

// POST /api/moderation/users/:userId/lift-warning - mark specific warning as lifted
router.post('/users/:userId/lift-warning', async (req, res) => {
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
        res.status(500).json({ message: 'Unable to lift warning.' });
    }
});

// Helper to resolve report model details based on type
const reportModelMap = {
    profile: {
        model: ProfileReport,
        populate: [
            { path: 'reporterId', select: 'personalName breederName email id_public' },
            { path: 'reportedUserId', select: 'personalName breederName email id_public profileImage bio websiteUrl showPersonalName showBreederName' }
        ]
    },
    animal: {
        model: AnimalReport,
        populate: [
            { path: 'reporterId', select: 'personalName breederName email id_public' },
            { 
                path: 'reportedAnimalId', 
                select: 'name id_public ownerId species gender variety images dateOfBirth status',
                populate: {
                    path: 'ownerId',
                    select: 'personalName breederName email id_public profileImage'
                }
            }
        ]
    },
    message: {
        model: MessageReport,
        populate: [
            { path: 'reporterId', select: 'personalName breederName email id_public' },
            { path: 'reportedUserId', select: 'personalName breederName email id_public profileImage' },
            { path: 'messageId', select: 'message senderId receiverId createdAt' }
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
        res.status(500).json({ message: 'Unable to remove profile image' });
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
        res.status(500).json({ message: 'Unable to remove animal image' });
    }
});

// PATCH /api/moderation/content/:contentType/:contentId/edit - Edit/redact content fields
router.patch('/content/:contentType/:contentId/edit', async (req, res) => {
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
                    status: 'approved', // Not a request, just informational
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
