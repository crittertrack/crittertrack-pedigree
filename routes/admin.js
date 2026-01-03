const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const { LoginAuditLog } = require('../database/2faModels');
const { Animal, PublicProfile, PublicAnimal, User, CommunityReport, AuditLog } = require('../database/models');
const { createAuditLog, getAuditLogs } = require('../utils/auditLogger');

// Helper: Check if user is admin
const isAdmin = (req) => {
    return req.user?.role === 'admin';
};

// Helper: Check if user is admin or moderator
const isModerator = (req) => {
    return ['admin', 'moderator'].includes(req.user?.role);
};

// ============================================
// 1. USER & ACCESS CONTROL
// ============================================

// GET /api/admin/users - List all users
router.get('/users', async (req, res) => {
    try {
        if (!isAdmin(req)) return res.status(403).json({ error: 'Admin only' });

        const users = await User.find({}, 'email username personalName role last_login_ip loginAttempts status adminPassword').lean();
        res.json(users);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// PATCH /api/admin/users/:userId/status - Suspend/activate user
router.patch('/users/:userId/status', async (req, res) => {
    try {
        if (!isAdmin(req)) return res.status(403).json({ error: 'Admin only' });

        const { status, reason } = req.body; // 'active', 'suspended', 'banned'
        
        if (!['active', 'suspended', 'banned'].includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }

        const user = await User.findById(req.params.userId);
        if (!user) return res.status(404).json({ error: 'User not found' });

        const oldStatus = user.accountStatus;
        
        // Update user status
        const updates = { accountStatus: status };
        
        if (status === 'suspended') {
            updates.suspensionReason = reason || 'Account suspended by administrator';
            updates.suspensionDate = new Date();
            updates.moderatedBy = req.user.id;
        } else if (status === 'banned') {
            updates.banReason = reason || 'Account banned by administrator';
            updates.banDate = new Date();
            updates.moderatedBy = req.user.id;
        }
        
        const updatedUser = await User.findByIdAndUpdate(req.params.userId, updates, { new: true });
        
        // Create audit log
        const actionMap = {
            active: 'user_activated',
            suspended: 'user_suspended',
            banned: 'user_banned'
        };
        
        await createAuditLog({
            moderatorId: req.user.id,
            moderatorEmail: req.user.email,
            action: actionMap[status],
            targetType: 'user',
            targetId: user._id,
            targetName: user.email,
            details: { oldStatus, newStatus: status },
            reason: reason || 'No reason provided',
            ipAddress: req.ip || req.connection.remoteAddress
        });
        
        res.json({ 
            success: true, 
            message: `User ${status}`,
            user: updatedUser 
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/admin/users/:userId/reset-password - Send password reset email
router.post('/users/:userId/reset-password', async (req, res) => {
    try {
        if (!isAdmin(req)) return res.status(403).json({ error: 'Admin only' });

        const user = await User.findById(req.params.userId);
        if (!user) return res.status(404).json({ error: 'User not found' });

        // TODO: Implement password reset email
        // For now, just return success
        res.json({ message: 'Password reset email would be sent to ' + user.email });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/admin/users/:userId/unlock - Unlock account
router.post('/users/:userId/unlock', async (req, res) => {
    try {
        if (!isAdmin(req)) return res.status(403).json({ error: 'Admin only' });

        const user = await User.findByIdAndUpdate(req.params.userId, { 
            loginAttempts: 0,
            status: 'active'
        }, { new: true });
        res.json(user);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/admin/users/:userId/login-history - View login history
router.get('/users/:userId/login-history', async (req, res) => {
    try {
        if (!isModerator(req)) return res.status(403).json({ error: 'Moderator only' });

        const history = await LoginAuditLog.find({ user_id: req.params.userId })
            .sort({ timestamp: -1 })
            .limit(50)
            .lean();
        res.json(history);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// PATCH /api/admin/users/:userId/role - Change user role (admin only)
router.patch('/users/:userId/role', async (req, res) => {
    try {
        if (!isAdmin(req)) return res.status(403).json({ error: 'Admin only' });

        const { role } = req.body;
        
        if (!['user', 'moderator', 'admin'].includes(role)) {
            return res.status(400).json({ error: 'Invalid role' });
        }

        const user = await User.findById(req.params.userId);
        if (!user) return res.status(404).json({ error: 'User not found' });

        const oldRole = user.role;
        user.role = role;
        await user.save();

        // Create audit log
        await createAuditLog({
            moderatorId: req.user.id,
            moderatorEmail: req.user.email,
            action: 'user_role_changed',
            targetType: 'user',
            targetId: user._id,
            targetName: user.email,
            details: { oldRole, newRole: role },
            reason: `Role changed from ${oldRole} to ${role}`,
            ipAddress: req.ip || req.connection.remoteAddress
        });

        res.json({ 
            success: true, 
            message: `User role changed to ${role}`,
            user: { id: user._id, email: user.email, role: user.role }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/admin/users/:userId/warn - Issue warning to user
router.post('/users/:userId/warn', async (req, res) => {
    try {
        if (!isModerator(req)) return res.status(403).json({ error: 'Moderator only' });

        const { reason } = req.body;
        
        const user = await User.findByIdAndUpdate(
            req.params.userId,
            { $inc: { warningCount: 1 } },
            { new: true }
        );

        if (!user) return res.status(404).json({ error: 'User not found' });

        // Auto-suspend after 3 warnings
        if (user.warningCount >= 3) {
            user.accountStatus = 'suspended';
            user.suspensionReason = 'Automatic suspension after 3 warnings';
            user.suspensionDate = new Date();
            user.moderatedBy = req.user.id;
            await user.save();
        }

        // Create audit log
        await createAuditLog({
            moderatorId: req.user.id,
            moderatorEmail: req.user.email,
            action: 'user_warned',
            targetType: 'user',
            targetId: user._id,
            targetName: user.email,
            details: { 
                warningCount: user.warningCount,
                autoSuspended: user.warningCount >= 3
            },
            reason: reason || 'No reason provided',
            ipAddress: req.ip || req.connection.remoteAddress
        });

        res.json({ 
            success: true, 
            message: `Warning issued (${user.warningCount} total)`,
            user: {
                id: user._id,
                email: user.email,
                warningCount: user.warningCount,
                accountStatus: user.accountStatus
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/admin/users/:userId/summary - Get user content summary
router.get('/users/:userId/summary', async (req, res) => {
    try {
        if (!isModerator(req)) return res.status(403).json({ error: 'Moderator only' });

        const userId = req.params.userId;
        const user = await User.findById(userId).select('email personalName breederName role accountStatus warningCount createdAt last_login');
        
        if (!user) return res.status(404).json({ error: 'User not found' });

        // Get content counts
        const animalCount = await Animal.countDocuments({ ownerId: userId });
        const publicAnimalCount = await PublicAnimal.countDocuments({ ownerId: userId });
        const litterCount = user.ownedLitters ? user.ownedLitters.length : 0;
        
        // Get reports filed by and against this user
        const reportsFiled = await CommunityReport.countDocuments({ reporterId: userId });
        const reportsAgainst = await CommunityReport.countDocuments({ contentOwnerId: userId });

        res.json({
            user: {
                id: user._id,
                email: user.email,
                personalName: user.personalName,
                breederName: user.breederName,
                role: user.role,
                accountStatus: user.accountStatus,
                warningCount: user.warningCount,
                createdAt: user.createdAt,
                lastLogin: user.last_login
            },
            content: {
                totalAnimals: animalCount,
                publicAnimals: publicAnimalCount,
                litters: litterCount
            },
            moderation: {
                reportsFiled,
                reportsAgainst
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/admin/users/:userId/moderation-history - Get moderation actions against user
router.get('/users/:userId/moderation-history', async (req, res) => {
    try {
        if (!isModerator(req)) return res.status(403).json({ error: 'Moderator only' });

        const history = await AuditLog.find({ 
            targetType: 'user',
            targetId: req.params.userId
        })
            .populate('moderatorId', 'email personalName')
            .sort({ createdAt: -1 })
            .limit(50)
            .lean();

        res.json(history);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// 2. ANIMAL & PEDIGREE MANAGEMENT
// ============================================

// GET /api/admin/animals - List all animals
router.get('/animals', async (req, res) => {
    try {
        if (!isAdmin(req)) return res.status(403).json({ error: 'Admin only' });

        const animals = await Animal.find({}).lean();
        res.json(animals);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/admin/animals/import - Import animals from CSV/JSON
router.post('/animals/import', async (req, res) => {
    try {
        if (!isAdmin(req)) return res.status(403).json({ error: 'Admin only' });

        // TODO: Implement file upload and parsing
        // This would handle CSV/Excel/JSON imports
        res.json({ success: 0, failed: 0, message: 'Import endpoint not fully implemented' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/admin/animals/export/csv - Export animals as CSV
router.get('/animals/export/csv', async (req, res) => {
    try {
        if (!isAdmin(req)) return res.status(403).json({ error: 'Admin only' });

        const animals = await Animal.find({}).lean();
        
        // Create CSV
        const headers = ['id', 'name', 'species', 'gender', 'status', 'owner', 'dateOfBirth'];
        const rows = animals.map(a => [
            a._id.toString(),
            a.name,
            a.species,
            a.gender,
            a.status,
            a.owner || '',
            a.dateOfBirth || ''
        ]);

        const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=animals.csv');
        res.send(csv);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/admin/animals/bulk-update - Bulk update animals
router.post('/animals/bulk-update', async (req, res) => {
    try {
        if (!isAdmin(req)) return res.status(403).json({ error: 'Admin only' });

        const { animalIds, updates } = req.body;
        const result = await Animal.updateMany(
            { _id: { $in: animalIds } },
            updates
        );
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// 3. DATA QUALITY & INTEGRITY
// ============================================

// GET /api/admin/audit-logs - Get system audit logs
router.get('/audit-logs', async (req, res) => {
    try {
        if (!isAdmin(req)) return res.status(403).json({ error: 'Admin only' });

        const logs = await LoginAuditLog.find({})
            .sort({ timestamp: -1 })
            .limit(100)
            .lean();
        res.json(logs);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/admin/backups - List available backups
router.get('/backups', async (req, res) => {
    try {
        if (!isAdmin(req)) return res.status(403).json({ error: 'Admin only' });

        // TODO: Implement backup list from storage service
        res.json([]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/admin/trigger-backup - Trigger manual backup
router.post('/trigger-backup', async (req, res) => {
    try {
        if (!isAdmin(req)) return res.status(403).json({ error: 'Admin only' });

        // TODO: Implement backup trigger
        res.json({ message: 'Backup started', timestamp: new Date() });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/admin/restore-backup/:backupId - Restore from backup
router.post('/restore-backup/:backupId', async (req, res) => {
    try {
        if (!isAdmin(req)) return res.status(403).json({ error: 'Admin only' });

        // TODO: Implement backup restore
        res.json({ message: 'Restore started', backupId: req.params.backupId });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/admin/validation-rules - Get data validation rules
router.get('/validation-rules', async (req, res) => {
    try {
        if (!isAdmin(req)) return res.status(403).json({ error: 'Admin only' });

        // Return default validation rules
        const rules = [
            { field: 'name', type: 'required', message: 'Animal name is required' },
            { field: 'species', type: 'required', message: 'Species is required' },
            { field: 'gender', type: 'enum', values: ['Male', 'Female', 'Unknown'] }
        ];
        res.json(rules);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// 4. CONTENT MODERATION
// ============================================

// GET /api/admin/reports - Get moderation reports
router.get('/reports', async (req, res) => {
    try {
        if (!isModerator(req)) return res.status(403).json({ error: 'Moderator only' });

        const { status = 'open' } = req.query;
        // TODO: Implement reports model and query
        res.json([]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/admin/reports/:reportId/approve - Approve reported edit
router.post('/reports/:reportId/approve', async (req, res) => {
    try {
        if (!isModerator(req)) return res.status(403).json({ error: 'Moderator only' });

        // TODO: Implement report approval
        res.json({ message: 'Report approved' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/admin/reports/:reportId/reject - Reject reported edit
router.post('/reports/:reportId/reject', async (req, res) => {
    try {
        if (!isModerator(req)) return res.status(403).json({ error: 'Moderator only' });

        // TODO: Implement report rejection
        res.json({ message: 'Report rejected' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/admin/send-moderator-message - Send message to user
router.post('/send-moderator-message', async (req, res) => {
    try {
        if (!isModerator(req)) return res.status(403).json({ error: 'Moderator only' });

        const { userId, message } = req.body;
        // TODO: Implement user messaging
        res.json({ message: 'Message sent', sentTo: userId });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// 5. SYSTEM CONFIGURATION
// ============================================

// GET /api/admin/system-settings - Get system settings
router.get('/system-settings', async (req, res) => {
    try {
        if (!isAdmin(req)) return res.status(403).json({ error: 'Admin only' });

        const settings = {
            litterTrackingEnabled: true,
            geneticAnalysisEnabled: true,
            communityMessagingEnabled: true,
            defaultPrivacyLevel: 'private',
            requireModerationForEdits: false,
            sessionTimeoutMinutes: 60,
            backupFrequency: 'daily',
            enableTwoFactorAuth: true
        };
        res.json(settings);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/admin/system-settings - Update system settings
router.post('/system-settings', async (req, res) => {
    try {
        if (!isAdmin(req)) return res.status(403).json({ error: 'Admin only' });

        // TODO: Implement settings persistence
        res.json({ message: 'Settings saved', settings: req.body });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/admin/api-keys - List API keys
router.get('/api-keys', async (req, res) => {
    try {
        if (!isAdmin(req)) return res.status(403).json({ error: 'Admin only' });

        // TODO: Implement API key management
        res.json([]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/admin/api-keys - Generate new API key
router.post('/api-keys', async (req, res) => {
    try {
        if (!isAdmin(req)) return res.status(403).json({ error: 'Admin only' });

        const { name } = req.body;
        // TODO: Generate and store API key
        res.json({ 
            name, 
            key: 'sk_' + Math.random().toString(36).substring(2, 15),
            created: new Date()
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// 6. REPORTING & ANALYTICS
// ============================================

// GET /api/admin/reports/analytics - Get analytics reports
router.get('/reports/analytics', async (req, res) => {
    try {
        if (!isModerator(req)) return res.status(403).json({ error: 'Moderator only' });

        const { range = 'month' } = req.query;
        
        const totalAnimals = await Animal.countDocuments({});
        const totalUsers = await User.countDocuments({});
        const activeUsers = await User.countDocuments({ last_login: { $gte: new Date(Date.now() - 30*24*60*60*1000) } });

        res.json({
            totalAnimals,
            totalLitters: 0, // TODO: Implement if litter tracking added
            activeUsers,
            totalUsers,
            recentSignups: 0,
            averageAnimalsPerUser: totalUsers > 0 ? totalAnimals / totalUsers : 0,
            topSpecies: []
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/admin/reports/export - Export report as PDF/CSV
router.get('/reports/export', async (req, res) => {
    try {
        if (!isModerator(req)) return res.status(403).json({ error: 'Moderator only' });

        // TODO: Implement PDF/CSV export
        res.setHeader('Content-Type', 'text/csv');
        res.send('Report export not implemented');
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// 7. COMMUNICATION
// ============================================

// POST /api/admin/send-broadcast - Send broadcast message
router.post('/send-broadcast', async (req, res) => {
    try {
        if (!isAdmin(req)) return res.status(403).json({ error: 'Admin only' });

        const { message, recipientType } = req.body;
        // TODO: Implement broadcast messaging
        res.json({ message: 'Broadcast sent', sentTo: 0 });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/admin/email-templates - Get email templates
router.get('/email-templates', async (req, res) => {
    try {
        if (!isModerator(req)) return res.status(403).json({ error: 'Moderator only' });

        const templates = [
            { id: 1, name: 'Welcome', subject: 'Welcome to CritterTrack' },
            { id: 2, name: 'Password Reset', subject: 'Reset Your Password' },
            { id: 3, name: 'Alert', subject: 'Important Alert' }
        ];
        res.json(templates);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/admin/email-templates - Create email template
router.post('/email-templates', async (req, res) => {
    try {
        if (!isAdmin(req)) return res.status(403).json({ error: 'Admin only' });

        const { name, subject, content } = req.body;
        // TODO: Implement template storage
        res.json({ name, subject, content, created: new Date() });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/admin/moderator-chat - Get moderator chat
router.get('/moderator-chat', async (req, res) => {
    try {
        if (!isModerator(req)) return res.status(403).json({ error: 'Moderator only' });

        // TODO: Implement moderator chat
        res.json([]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// COMMUNITY REPORT ENDPOINTS
// ============================================

// POST /api/admin/reports/submit - Submit a content report (any authenticated user)
router.post('/reports/submit', async (req, res) => {
    try {
        if (!req.user) return res.status(401).json({ error: 'Authentication required' });

        const { contentType, contentId, category, description, contentOwnerId, reportedField } = req.body;

        // Validate required fields
        if (!contentType || !contentId || !category || !description) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Validate contentType
        const validContentTypes = ['animal', 'profile', 'other'];
        if (!validContentTypes.includes(contentType)) {
            return res.status(400).json({ error: 'Invalid content type' });
        }

        // Validate category - only specific violations allowed (NOT data accuracy)
        const validCategories = [
            'inappropriate_content',
            'harassment_bullying',
            'spam',
            'copyright_violation',
            'community_guidelines_violation',
            'other'
        ];
        if (!validCategories.includes(category)) {
            return res.status(400).json({ error: 'Invalid report category' });
        }

        // Validate description length
        if (description.length > 2000) {
            return res.status(400).json({ error: 'Description too long (max 2000 characters)' });
        }

        // Convert public IDs to internal MongoDB IDs
        let internalContentId = null;
        let internalContentOwnerId = null;

        try {
            // If contentId looks like a public ID, convert it
            if (contentType === 'animal') {
                const animal = await Animal.findOne({ id_public: contentId }).select('_id userId');
                if (animal) {
                    internalContentId = animal._id;
                    internalContentOwnerId = internalContentOwnerId || animal.userId;
                }
            } else if (contentType === 'profile') {
                const user = await User.findOne({ id_public: contentId }).select('_id');
                if (user) {
                    internalContentId = user._id;
                    internalContentOwnerId = internalContentOwnerId || user._id;
                }
            }
        } catch (lookupError) {
            console.warn('Failed to lookup internal IDs:', lookupError);
        }

        // Use provided contentOwnerId if it's already an internal ID, otherwise use looked up ID
        const finalContentOwnerId = (contentOwnerId && contentOwnerId.length === 24) ? contentOwnerId : internalContentOwnerId;

        // Prevent users from reporting their own content
        if (finalContentOwnerId && String(req.user.id) === String(finalContentOwnerId)) {
            return res.status(400).json({ error: 'Cannot report your own content' });
        }

        // Create report
        const report = new CommunityReport({
            reporterId: req.user.id,
            reporterEmail: req.user.email,
            contentType,
            contentId: internalContentId,
            contentOwnerId: finalContentOwnerId || null,
            reportedField: reportedField || 'other',
            category,
            description,
            status: 'open',
            createdAt: new Date()
        });

        const saved = await report.save();

        res.status(201).json({
            success: true,
            message: 'Report submitted successfully',
            reportId: saved._id
        });
    } catch (error) {
        console.error('Report submission error:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/admin/reports - List reports (moderators only)
router.get('/reports/list', async (req, res) => {
    try {
        if (!isModerator(req)) return res.status(403).json({ error: 'Moderator access required' });

        const { status, category, sort = '-createdAt', limit = 50, skip = 0 } = req.query;

        // Build filter
        const filter = {};
        if (status && ['open', 'in_review', 'resolved', 'dismissed'].includes(status)) {
            filter.status = status;
        }
        if (category) {
            filter.category = category;
        }

        // Fetch reports with populated references
        const reports = await CommunityReport.find(filter)
            .populate('reporterId', 'email personalName id_public')
            .populate('contentOwnerId', 'email personalName breederName id_public')
            .populate('moderatorId', 'email personalName id_public')
            .sort(sort)
            .limit(parseInt(limit))
            .skip(parseInt(skip))
            .lean();

        // Enrich reports with content details
        const enrichedReports = await Promise.all(reports.map(async (report) => {
            let contentDetails = null;
            
            try {
                if (report.contentType === 'animal' && report.contentId) {
                    const animal = await Animal.findById(report.contentId).select('name id_public species gender').lean();
                    contentDetails = animal;
                } else if (report.contentType === 'profile' && report.contentId) {
                    const profileUser = await User.findById(report.contentId).select('personalName breederName email id_public').lean();
                    contentDetails = profileUser;
                }
            } catch (err) {
                console.warn('Failed to fetch content details:', err);
            }
            
            return {
                ...report,
                contentDetails
            };
        }));

        // Get total count for pagination
        const total = await CommunityReport.countDocuments(filter);

        res.json({
            reports: enrichedReports,
            total,
            limit: parseInt(limit),
            skip: parseInt(skip)
        });
    } catch (error) {
        console.error('Report listing error:', error);
        res.status(500).json({ error: error.message });
    }
});

// PATCH /api/admin/reports/:reportId/status - Update report status (moderators only)
router.patch('/reports/:reportId/status', async (req, res) => {
    try {
        if (!isModerator(req)) return res.status(403).json({ error: 'Moderator access required' });

        const { reportId } = req.params;
        const { status, moderatorNotes } = req.body;

        // Validate status
        const validStatuses = ['open', 'in_review', 'resolved', 'dismissed'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }

        // Update report
        const report = await CommunityReport.findByIdAndUpdate(
            reportId,
            {
                status,
                moderatorId: req.user.id,
                moderatorNotes: moderatorNotes || '',
                resolvedAt: ['resolved', 'dismissed'].includes(status) ? new Date() : null
            },
            { new: true }
        );

        if (!report) {
            return res.status(404).json({ error: 'Report not found' });
        }

        res.json({
            success: true,
            message: `Report status updated to ${status}`,
            report
        });
    } catch (error) {
        console.error('Report status update error:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST /api/admin/reports/:reportId/action - Take action on report (mods/admins only)
router.post('/reports/:reportId/action', async (req, res) => {
    try {
        if (!isModerator(req)) return res.status(403).json({ error: 'Moderator access required' });

        const { reportId } = req.params;
        const { action, reason, replacementText } = req.body;
        
        // Ban is admin only
        if (action === 'ban_user' && !isAdmin(req)) {
            return res.status(403).json({ error: 'Only admins can ban users' });
        }

        const validActions = ['remove_content', 'replace_content', 'warn_user', 'suspend_user', 'ban_user'];
        if (!validActions.includes(action)) {
            return res.status(400).json({ error: 'Invalid action' });
        }

        // Get the report
        const report = await CommunityReport.findById(reportId);
        if (!report) {
            return res.status(404).json({ error: 'Report not found' });
        }

        // Execute action
        switch (action) {
            case 'remove_content':
                // Only remove non-mandatory fields
                const nonMandatoryFields = ['animal_description', 'animal_remarks', 'animal_color', 'profile_description', 'profile_website'];
                if (!nonMandatoryFields.includes(report.reportedField)) {
                    return res.status(400).json({ error: 'Cannot remove mandatory field. Use replace_content instead.' });
                }
                
                if (report.contentType === 'animal') {
                    const fieldMap = { 'animal_image': 'photoUrl', 'animal_description': 'description', 'animal_remarks': 'remarks' };
                    const dbField = fieldMap[report.reportedField] || report.reportedField;
                    await Animal.findByIdAndUpdate(report.contentId, { [dbField]: null });
                } else if (report.contentType === 'profile') {
                    const fieldMap = { 'profile_image': 'profileImage', 'profile_description': 'description' };
                    const dbField = fieldMap[report.reportedField] || report.reportedField;
                    await PublicProfile.findByIdAndUpdate(report.contentId, { [dbField]: null });
                }
                break;

            case 'replace_content':
                if (!replacementText) {
                    return res.status(400).json({ error: 'Replacement text required' });
                }
                
                if (report.contentType === 'animal') {
                    const fieldMap = { 'animal_name': 'name', 'animal_color': 'color', 'animal_description': 'description', 'animal_remarks': 'remarks' };
                    const dbField = fieldMap[report.reportedField] || report.reportedField;
                    await Animal.findByIdAndUpdate(report.contentId, { [dbField]: replacementText });
                } else if (report.contentType === 'profile') {
                    const fieldMap = { 'profile_name': 'personalName', 'profile_description': 'description' };
                    const dbField = fieldMap[report.reportedField] || report.reportedField;
                    await PublicProfile.findByIdAndUpdate(report.contentId, { [dbField]: replacementText });
                }
                break;

            case 'warn_user':
                if (report.contentOwnerId) {
                    const user = await User.findByIdAndUpdate(
                        report.contentOwnerId,
                        { $inc: { warningCount: 1 } },
                        { new: true }
                    );
                    if (user && user.warningCount >= 3) {
                        // Auto-suspend after 3 warnings
                        await User.findByIdAndUpdate(report.contentOwnerId, { accountStatus: 'suspended' });
                    }
                }
                break;

            case 'suspend_user':
                if (report.contentOwnerId) {
                    await User.findByIdAndUpdate(report.contentOwnerId, {
                        accountStatus: 'suspended',
                        suspensionReason: reason || 'Community guideline violation'
                    });
                }
                break;

            case 'ban_user':
                if (report.contentOwnerId) {
                    await User.findByIdAndUpdate(report.contentOwnerId, {
                        accountStatus: 'banned',
                        banReason: reason || 'Serious community guideline violation'
                    });
                }
                break;
        }

        // Update report with action taken
        await CommunityReport.findByIdAndUpdate(reportId, {
            status: 'resolved',
            actionTaken: action === 'replace_content' ? 'content_replaced' : action === 'remove_content' ? 'content_removed' : action,
            replacedWith: action === 'replace_content' ? replacementText : null,
            moderatorId: req.user.id,
            moderatorNotes: reason || '',
            resolvedAt: new Date()
        });

        // Create audit log for the action
        await createAuditLog({
            moderatorId: req.user.id,
            moderatorEmail: req.user.email,
            action: 'report_resolved',
            targetType: 'report',
            targetId: reportId,
            targetName: `Report on ${report.contentType}`,
            details: {
                actionTaken: action,
                reportedField: report.reportedField,
                contentType: report.contentType,
                replacementText: action === 'replace_content' ? replacementText : undefined
            },
            reason: reason || 'No reason provided',
            ipAddress: req.ip || req.connection.remoteAddress
        });

        res.json({
            success: true,
            message: `Action '${action}' completed on report`
        });
    } catch (error) {
        console.error('Report action error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// ORIGINAL: Cleanup orphans endpoint
// ============================================

// POST /api/admin/cleanup-orphans
router.post('/cleanup-orphans', async (req, res) => {
    try {
        const adminUser = process.env.ADMIN_USER_ID;
        if (!adminUser) return res.status(500).json({ message: 'ADMIN_USER_ID not configured on server.' });
        if (!req.user || String(req.user.id) !== String(adminUser)) return res.status(403).json({ message: 'Forbidden: admin only.' });

        const uploadsDir = path.join(__dirname, '..', 'uploads');
        const files = fs.existsSync(uploadsDir) ? fs.readdirSync(uploadsDir) : [];
        const referenced = new Set();

        const animals = await Animal.find({}, 'imageUrl photoUrl').lean().catch(() => []);
        animals.forEach(a => { if (a.imageUrl) referenced.add(path.basename(a.imageUrl)); if (a.photoUrl) referenced.add(path.basename(a.photoUrl)); });

        const profiles = await PublicProfile.find({}, 'profileImage').lean().catch(() => []);
        profiles.forEach(p => { if (p.profileImage) referenced.add(path.basename(p.profileImage)); });

        try {
            const pubA = await PublicAnimal.find({}, 'imageUrl').lean();
            pubA.forEach(p => { if (p.imageUrl) referenced.add(path.basename(p.imageUrl)); });
        } catch (e) { /* ignore */ }

        try {
            const users = await User.find({}, 'profileImage').lean();
            users.forEach(u => { if (u.profileImage) referenced.add(path.basename(u.profileImage)); });
        } catch (e) { /* ignore */ }

        const orphanFiles = files.filter(f => !referenced.has(f));
        const missingFiles = [];
        referenced.forEach(fn => { if (!files.includes(fn)) missingFiles.push(fn); });

        const doDelete = req.body && req.body.delete === true;
        const deleted = [];
        const failed = [];
        if (doDelete && orphanFiles.length > 0) {
            for (const fn of orphanFiles) {
                try {
                    fs.unlinkSync(path.join(uploadsDir, fn));
                    deleted.push(fn);
                } catch (err) {
                    failed.push({ file: fn, error: err && err.message ? err.message : String(err) });
                }
            }
        }

        return res.json({ orphanFiles, missingFiles, deleted, failed });
    } catch (err) {
        console.error('Admin cleanup error:', err && err.stack ? err.stack : err);
        return res.status(500).json({ message: 'Failed to run cleanup', error: err && err.message ? err.message : String(err) });
    }
});

// ============================================
// AUDIT LOG ENDPOINTS
// ============================================

// GET /api/admin/audit-logs/list - Get audit logs with filtering
router.get('/audit-logs/list', async (req, res) => {
    try {
        if (!isModerator(req)) return res.status(403).json({ error: 'Moderator only' });

        const { moderatorId, action, targetType, targetId, startDate, endDate, limit, skip, sort } = req.query;

        const result = await getAuditLogs(
            { moderatorId, action, targetType, targetId, startDate, endDate },
            { limit, skip, sort }
        );

        res.json(result);
    } catch (error) {
        console.error('Error fetching audit logs:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/admin/audit-logs/moderator/:moderatorId - Get actions by specific moderator
router.get('/audit-logs/moderator/:moderatorId', async (req, res) => {
    try {
        if (!isAdmin(req)) return res.status(403).json({ error: 'Admin only' });

        const { limit = 50, skip = 0 } = req.query;

        const logs = await AuditLog.find({ moderatorId: req.params.moderatorId })
            .sort({ createdAt: -1 })
            .limit(parseInt(limit))
            .skip(parseInt(skip))
            .lean();

        const total = await AuditLog.countDocuments({ moderatorId: req.params.moderatorId });

        res.json({ logs, total });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// ANIMAL MODERATION ENDPOINTS
// ============================================

// PATCH /api/admin/animals/:animalId/hide - Hide animal from public view
router.patch('/animals/:animalId/hide', async (req, res) => {
    try {
        if (!isModerator(req)) return res.status(403).json({ error: 'Moderator only' });

        const { reason } = req.body;
        const animal = await Animal.findById(req.params.animalId);
        
        if (!animal) return res.status(404).json({ error: 'Animal not found' });

        // Remove from PublicAnimal collection
        await PublicAnimal.deleteOne({ id_public: animal.id_public });
        
        // Update animal to not be public
        animal.showOnPublicProfile = false;
        await animal.save();

        // Create audit log
        await createAuditLog({
            moderatorId: req.user.id,
            moderatorEmail: req.user.email,
            action: 'content_hidden',
            targetType: 'animal',
            targetId: animal._id,
            targetName: animal.name,
            details: { ownerId: animal.ownerId },
            reason: reason || 'Hidden by moderator',
            ipAddress: req.ip || req.connection.remoteAddress
        });

        res.json({ 
            success: true, 
            message: 'Animal hidden from public view'
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE /api/admin/animals/:animalId - Force delete animal (admin only)
router.delete('/animals/:animalId', async (req, res) => {
    try {
        if (!isAdmin(req)) return res.status(403).json({ error: 'Admin only' });

        const { reason } = req.body;
        const animal = await Animal.findById(req.params.animalId);
        
        if (!animal) return res.status(404).json({ error: 'Animal not found' });

        const animalData = { name: animal.name, id_public: animal.id_public, ownerId: animal.ownerId };

        // Remove from public collection
        await PublicAnimal.deleteOne({ id_public: animal.id_public });
        
        // Delete the animal
        await Animal.deleteOne({ _id: req.params.animalId });

        // Create audit log
        await createAuditLog({
            moderatorId: req.user.id,
            moderatorEmail: req.user.email,
            action: 'animal_deleted',
            targetType: 'animal',
            targetId: animal._id,
            targetName: animalData.name,
            details: animalData,
            reason: reason || 'Deleted by admin',
            ipAddress: req.ip || req.connection.remoteAddress
        });

        res.json({ 
            success: true, 
            message: 'Animal permanently deleted'
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// PATCH /api/admin/profiles/:userId/hide - Hide public profile
router.patch('/profiles/:userId/hide', async (req, res) => {
    try {
        if (!isModerator(req)) return res.status(403).json({ error: 'Moderator only' });

        const { reason } = req.body;
        const user = await User.findById(req.params.userId);
        
        if (!user) return res.status(404).json({ error: 'User not found' });

        // Update public profile visibility
        await PublicProfile.updateOne(
            { userId_backend: user._id },
            { $set: { showPersonalName: false, showBreederName: false } }
        );

        // Create audit log
        await createAuditLog({
            moderatorId: req.user.id,
            moderatorEmail: req.user.email,
            action: 'profile_hidden',
            targetType: 'profile',
            targetId: user._id,
            targetName: user.email,
            reason: reason || 'Hidden by moderator',
            ipAddress: req.ip || req.connection.remoteAddress
        });

        res.json({ 
            success: true, 
            message: 'Public profile hidden'
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// COMMUNICATION ENDPOINTS
// ============================================

// POST /api/admin/broadcast - Send broadcast message to users
router.post('/broadcast', async (req, res) => {
    try {
        if (!isAdmin(req)) return res.status(403).json({ error: 'Admin only' });

        const { subject, message, recipientType, specificUserIds } = req.body;
        
        if (!subject || !message) {
            return res.status(400).json({ error: 'Subject and message required' });
        }

        // Determine recipients based on type
        let recipients = [];
        
        if (recipientType === 'specific' && specificUserIds) {
            recipients = await User.find({ _id: { $in: specificUserIds } }).select('_id email personalName');
        } else if (recipientType === 'all') {
            recipients = await User.find({}).select('_id email personalName');
        } else if (recipientType === 'active') {
            const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
            recipients = await User.find({ last_login: { $gte: thirtyDaysAgo } }).select('_id email personalName');
        } else if (recipientType === 'moderators') {
            recipients = await User.find({ role: { $in: ['moderator', 'admin'] } }).select('_id email personalName');
        } else if (recipientType === 'country' && req.body.country) {
            recipients = await User.find({ country: req.body.country }).select('_id email personalName');
        } else {
            return res.status(400).json({ error: 'Invalid recipient type' });
        }

        // Create notifications for all recipients
        const { Notification } = require('../database/models');
        const notifications = recipients.map(user => ({
            userId: user._id,
            type: 'announcement',
            message: `${subject}: ${message}`,
            isRead: false,
            createdAt: new Date()
        }));

        if (notifications.length > 0) {
            await Notification.insertMany(notifications);
        }

        // Create audit log
        await createAuditLog({
            moderatorId: req.user.id,
            moderatorEmail: req.user.email,
            action: 'broadcast_sent',
            targetType: 'system',
            targetId: null,
            targetName: 'Broadcast Message',
            details: {
                subject,
                recipientType,
                recipientCount: recipients.length,
                messageLength: message.length
            },
            reason: `Broadcast to ${recipients.length} users`,
            ipAddress: req.ip || req.connection.remoteAddress
        });

        res.json({
            success: true,
            message: `Broadcast sent to ${recipients.length} users`,
            recipientCount: recipients.length
        });
    } catch (error) {
        console.error('Broadcast error:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/admin/broadcast-history - Get past broadcasts
router.get('/broadcast-history', async (req, res) => {
    try {
        if (!isModerator(req)) return res.status(403).json({ error: 'Moderator only' });

        const { limit = 20, skip = 0 } = req.query;

        const broadcasts = await AuditLog.find({ 
            action: 'broadcast_sent'
        })
            .populate('moderatorId', 'email personalName')
            .sort({ createdAt: -1 })
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
        res.status(500).json({ error: error.message });
    }
});

// POST /api/admin/message-user - Send direct message to user
router.post('/message-user', async (req, res) => {
    try {
        if (!isModerator(req)) return res.status(403).json({ error: 'Moderator only' });

        const { userId, message } = req.body;

        if (!userId || !message) {
            return res.status(400).json({ error: 'User ID and message required' });
        }

        const { Notification } = require('../database/models');
        
        await Notification.create({
            userId,
            type: 'moderator_message',
            message,
            isRead: false,
            createdAt: new Date()
        });

        // Create audit log
        await createAuditLog({
            moderatorId: req.user.id,
            moderatorEmail: req.user.email,
            action: 'message_sent',
            targetType: 'user',
            targetId: userId,
            targetName: 'Direct Message',
            details: { messageLength: message.length },
            reason: 'Moderator message to user',
            ipAddress: req.ip || req.connection.remoteAddress
        });

        res.json({
            success: true,
            message: 'Message sent to user'
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// SYSTEM SETTINGS ENDPOINTS
// ============================================

// GET /api/admin/system-settings - Get all system settings
router.get('/system-settings/all', async (req, res) => {
    try {
        if (!isAdmin(req)) return res.status(403).json({ error: 'Admin only' });

        const { SystemSettings } = require('../database/models');
        const settings = await SystemSettings.find({}).lean();

        // Convert array to object for easier frontend use
        const settingsObj = {};
        settings.forEach(setting => {
            settingsObj[setting.key] = {
                value: setting.value,
                type: setting.type,
                category: setting.category,
                description: setting.description,
                lastModified: setting.lastModified
            };
        });

        res.json(settingsObj);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/admin/system-settings/:key - Get specific setting
router.get('/system-settings/:key', async (req, res) => {
    try {
        if (!isAdmin(req)) return res.status(403).json({ error: 'Admin only' });

        const { SystemSettings } = require('../database/models');
        const setting = await SystemSettings.findOne({ key: req.params.key }).lean();

        if (!setting) {
            return res.status(404).json({ error: 'Setting not found' });
        }

        res.json(setting);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// PUT /api/admin/system-settings/:key - Update setting
router.put('/system-settings/:key', async (req, res) => {
    try {
        if (!isAdmin(req)) return res.status(403).json({ error: 'Admin only' });

        const { value, type, category, description } = req.body;

        if (value === undefined) {
            return res.status(400).json({ error: 'Value required' });
        }

        const { SystemSettings } = require('../database/models');
        
        const oldSetting = await SystemSettings.findOne({ key: req.params.key });
        const oldValue = oldSetting ? oldSetting.value : null;

        const setting = await SystemSettings.findOneAndUpdate(
            { key: req.params.key },
            {
                value,
                type: type || 'string',
                category: category || 'features',
                description: description || '',
                lastModified: new Date(),
                modifiedBy: req.user.id
            },
            { upsert: true, new: true }
        );

        // Create audit log
        await createAuditLog({
            moderatorId: req.user.id,
            moderatorEmail: req.user.email,
            action: 'setting_changed',
            targetType: 'setting',
            targetId: setting._id,
            targetName: req.params.key,
            details: {
                oldValue,
                newValue: value,
                category: setting.category
            },
            reason: `Setting '${req.params.key}' updated`,
            ipAddress: req.ip || req.connection.remoteAddress
        });

        res.json({
            success: true,
            setting
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/admin/maintenance-status - Check current maintenance mode status
router.get('/maintenance-status', async (req, res) => {
    try {
        const { SystemSettings } = require('../database/models');
        
        const enabledSetting = await SystemSettings.findOne({ key: 'maintenance_mode_enabled' }).lean();
        const messageSetting = await SystemSettings.findOne({ key: 'maintenance_mode_message' }).lean();
        
        res.json({
            active: enabledSetting?.value || false,
            message: messageSetting?.value || 'System is under maintenance. Please check back later.'
        });
    } catch (error) {
        console.error('Error fetching maintenance status:', error);
        res.status(500).json({ error: 'Failed to fetch maintenance status' });
    }
});

// POST /api/admin/maintenance/toggle - Toggle maintenance mode
router.post('/maintenance/toggle', async (req, res) => {
    try {
        if (!isAdmin(req)) return res.status(403).json({ error: 'Admin only' });

        const { enabled, message } = req.body;

        const { SystemSettings } = require('../database/models');
        
        await SystemSettings.findOneAndUpdate(
            { key: 'maintenance_mode_enabled' },
            {
                value: enabled,
                type: 'boolean',
                category: 'maintenance',
                lastModified: new Date(),
                modifiedBy: req.user.id
            },
            { upsert: true }
        );

        if (message) {
            await SystemSettings.findOneAndUpdate(
                { key: 'maintenance_mode_message' },
                {
                    value: message,
                    type: 'string',
                    category: 'maintenance',
                    lastModified: new Date(),
                    modifiedBy: req.user.id
                },
                { upsert: true }
            );
        }

        // Create audit log
        await createAuditLog({
            moderatorId: req.user.id,
            moderatorEmail: req.user.email,
            action: 'setting_changed',
            targetType: 'system',
            targetId: null,
            targetName: 'Maintenance Mode',
            details: { enabled, message },
            reason: enabled ? 'Maintenance mode enabled' : 'Maintenance mode disabled',
            ipAddress: req.ip || req.connection.remoteAddress
        });

        res.json({
            success: true,
            maintenanceMode: {
                enabled,
                message
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
