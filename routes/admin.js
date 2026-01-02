const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const { LoginAuditLog } = require('../database/2faModels');
const { Animal, PublicProfile, PublicAnimal, User, CommunityReport } = require('../database/models');

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

        const { status } = req.body; // 'active', 'suspended', 'banned'
        const user = await User.findByIdAndUpdate(req.params.userId, { status }, { new: true });
        res.json(user);
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

// POST /api/reports - Submit a content report (any authenticated user)
router.post('/submit', async (req, res) => {
    try {
        if (!req.user) return res.status(401).json({ error: 'Authentication required' });

        const { contentType, contentId, category, description, contentOwnerId } = req.body;

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

        // Prevent users from reporting their own content
        if (contentOwnerId && String(req.user.id) === String(contentOwnerId)) {
            return res.status(400).json({ error: 'Cannot report your own content' });
        }

        // Create report
        const report = new CommunityReport({
            reporterId: req.user.id,
            reporterEmail: req.user.email,
            contentType,
            contentId,
            contentOwnerId: contentOwnerId || null,
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
router.get('/list', async (req, res) => {
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

        // Fetch reports
        const reports = await CommunityReport.find(filter)
            .sort(sort)
            .limit(parseInt(limit))
            .skip(parseInt(skip))
            .lean();

        // Get total count for pagination
        const total = await CommunityReport.countDocuments(filter);

        res.json({
            reports,
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
router.patch('/:reportId/status', async (req, res) => {
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

// POST /api/admin/reports/:reportId/action - Take action on report (admins only)
router.post('/:reportId/action', async (req, res) => {
    try {
        if (!isAdmin(req)) return res.status(403).json({ error: 'Admin access required' });

        const { reportId } = req.params;
        const { action, reason } = req.body; // action: remove_content, warn_user, suspend_user, ban_user

        const validActions = ['remove_content', 'warn_user', 'suspend_user', 'ban_user'];
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
                if (report.contentType === 'animal') {
                    await Animal.findByIdAndDelete(report.contentId);
                } else if (report.contentType === 'profile') {
                    await PublicProfile.findByIdAndDelete(report.contentId);
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
            actionTaken: action,
            moderatorId: req.user.id,
            moderatorNotes: reason || '',
            resolvedAt: new Date()
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

module.exports = router;
