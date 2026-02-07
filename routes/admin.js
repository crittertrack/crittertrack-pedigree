const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const { LoginAuditLog } = require('../database/2faModels');
const { Animal, PublicProfile, PublicAnimal, User, ProfileReport, AnimalReport, MessageReport, AuditLog, ModChat } = require('../database/models');
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

        const users = await User.find({}, '_id id_public email username personalName role last_login_ip loginAttempts accountStatus adminPassword').lean();
        res.json(users);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/admin/users/moderation-overview - Get all users with moderation history
router.get('/users/moderation-overview', async (req, res) => {
    try {
        if (!isModerator(req)) return res.status(403).json({ error: 'Moderator access required' });

        // Get all users with relevant fields including login info
        const users = await User.find({})
            .select('id_public email personalName breederName accountStatus role warningCount warnings suspensionReason suspensionDate suspensionExpiry banReason banDate banType bannedIP moderatedBy creationDate last_login last_login_ip')
            .lean();

        // Get Animal and Message models for counts
        const Animal = require('../database/models').Animal;
        const Message = require('../database/models').Message;

        // Get moderation history for each user from audit logs
        const usersWithHistory = await Promise.all(users.map(async (user) => {
            // Get audit logs for this user
            const auditLogs = await AuditLog.find({
                targetId: user._id
            })
            .select('action reason timestamp moderatorEmail details')
            .sort({ timestamp: -1 })
            .limit(10)
            .lean();

            // Get reports involving this user
            const profileReports = await ProfileReport.find({
                $or: [
                    { reportedUserId: user._id },
                    { reportedBy: user._id }
                ]
            }).select('reason status createdAt category').lean();

            // Get user metrics (counts)
            const [animalCount, messageCount] = await Promise.all([
                Animal.countDocuments({ ownerId: user._id }),
                Message.countDocuments({ senderId: user._id })
            ]);

            return {
                ...user,
                moderationHistory: auditLogs,
                reportCount: profileReports.length,
                recentReports: profileReports.slice(0, 5),
                metrics: {
                    animalCount,
                    messageCount
                }
            };
        }));

        res.json({ users: usersWithHistory });
    } catch (error) {
        console.error('Error fetching moderation overview:', error);
        res.status(500).json({ error: error.message });
    }
});

// PATCH /api/admin/users/:userId/status - Suspend/activate user
router.patch('/users/:userId/status', async (req, res) => {
    try {
        if (!isAdmin(req)) return res.status(403).json({ error: 'Admin only' });

        const { status, reason } = req.body; // 'normal', 'suspended', 'banned'
        
        if (!['normal', 'suspended', 'banned'].includes(status)) {
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
            targetName: `${user.email} (${user.id_public || 'No ID'})`,
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
            status: 'normal'
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
            targetName: `${user.email} (${user.id_public || 'No ID'})`,
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
        const user = await User.findById(userId).select('email personalName breederName role accountStatus warningCount createdAt last_login id_public');
        
        if (!user) return res.status(404).json({ error: 'User not found' });

        // Get content counts
        const animalCount = await Animal.countDocuments({ ownerId: userId });
        const publicAnimalCount = await PublicAnimal.countDocuments({ ownerId: userId });
        const litterCount = user.ownedLitters ? user.ownedLitters.length : 0;
        
        // Get reports filed by and against this user
        const reportsFiled = await Promise.all([
            ProfileReport.countDocuments({ reporterId: userId }),
            AnimalReport.countDocuments({ reporterId: userId }),
            MessageReport.countDocuments({ reporterId: userId })
        ]).then(counts => counts.reduce((a, b) => a + b, 0));
        
        const reportsAgainst = await Promise.all([
            ProfileReport.countDocuments({ reportedUserId: userId }),
            MessageReport.countDocuments({ reportedUserId: userId })
        ]).then(counts => counts.reduce((a, b) => a + b, 0));

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

// GET /api/admin/animals - List animals with pagination, search, and filters
router.get('/animals', async (req, res) => {
    try {
        if (!isModerator(req)) return res.status(403).json({ error: 'Moderator only' });

        const { 
            page = 1, 
            limit = 50, 
            search = '', 
            species = '',
            isPublic = '',
            hasReports = '',
            owner = '',
            sortBy = 'createdAt',
            sortOrder = 'desc'
        } = req.query;

        // Build query
        const query = {};
        
        if (search) {
            query.$or = [
                { id_public: { $regex: search, $options: 'i' } },
                { name: { $regex: search, $options: 'i' } },
                { prefix: { $regex: search, $options: 'i' } },
                { suffix: { $regex: search, $options: 'i' } }
            ];
        }
        
        if (species) {
            query.species = species;
        }
        
        if (isPublic === 'true') {
            query.showOnPublicProfile = true;
        } else if (isPublic === 'false') {
            query.showOnPublicProfile = { $ne: true };
        }
        
        if (owner) {
            query.ownerId_public = owner;
        }

        // Get animals with pagination
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

        const [animals, total] = await Promise.all([
            Animal.find(query)
                .select('id_public name prefix suffix species gender status ownerId ownerId_public originalOwnerId showOnPublicProfile imageUrl createdAt soldStatus breederId_public')
                .populate('ownerId', 'email personalName id_public')
                .populate('originalOwnerId', 'email personalName id_public')
                .sort(sort)
                .skip(skip)
                .limit(parseInt(limit))
                .lean(),
            Animal.countDocuments(query)
        ]);

        // Get report counts for these animals
        const animalIds = animals.map(a => a._id);
        const reportCounts = await AnimalReport.aggregate([
            { $match: { reportedAnimalId: { $in: animalIds }, status: 'pending' } },
            { $group: { _id: '$reportedAnimalId', count: { $sum: 1 } } }
        ]);
        const reportCountMap = {};
        reportCounts.forEach(r => { reportCountMap[r._id.toString()] = r.count; });

        // Filter by hasReports if specified
        let filteredAnimals = animals;
        if (hasReports === 'true') {
            filteredAnimals = animals.filter(a => reportCountMap[a._id.toString()] > 0);
        } else if (hasReports === 'false') {
            filteredAnimals = animals.filter(a => !reportCountMap[a._id.toString()]);
        }

        // Add report count to each animal
        const animalsWithReports = filteredAnimals.map(a => ({
            ...a,
            pendingReports: reportCountMap[a._id.toString()] || 0
        }));

        // Get unique species for filter dropdown
        const speciesList = await Animal.distinct('species');

        res.json({
            animals: animalsWithReports,
            total: hasReports ? filteredAnimals.length : total,
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: Math.ceil((hasReports ? filteredAnimals.length : total) / parseInt(limit)),
            speciesList
        });
    } catch (error) {
        console.error('Admin animals list error:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/admin/animals/:animalId - Get single animal details for editing
router.get('/animals/:animalId', async (req, res) => {
    try {
        if (!isModerator(req)) return res.status(403).json({ error: 'Moderator only' });

        const { animalId } = req.params;

        // Try by ObjectId first, then by public ID
        let animal = null;
        const mongoose = require('mongoose');
        
        if (mongoose.Types.ObjectId.isValid(animalId)) {
            animal = await Animal.findById(animalId)
                .populate('ownerId', 'email personalName id_public')
                .populate('originalOwnerId', 'email personalName id_public')
                .lean();
        }
        
        if (!animal) {
            animal = await Animal.findOne({ id_public: animalId })
                .populate('ownerId', 'email personalName id_public')
                .populate('originalOwnerId', 'email personalName id_public')
                .lean();
        }

        if (!animal) {
            return res.status(404).json({ error: 'Animal not found' });
        }

        // Get reports for this animal
        const reports = await AnimalReport.find({ reportedAnimalId: animal._id })
            .populate('reporterId', 'email personalName id_public')
            .populate('reviewedBy', 'email personalName')
            .sort({ createdAt: -1 })
            .lean();

        res.json({ animal, reports });
    } catch (error) {
        console.error('Admin animal detail error:', error);
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

// GET /api/admin/audit-logs - Get system audit logs with filtering and pagination
router.get('/audit-logs', async (req, res) => {
    try {
        if (!isModerator(req)) return res.status(403).json({ error: 'Moderator access required' });

        const { 
            page = 1, 
            limit = 50, 
            action, 
            moderator, 
            targetUser, 
            startDate, 
            endDate,
            search 
        } = req.query;

        const query = {};

        // Filter by action type
        if (action && action !== 'all') {
            query.action = action;
        }

        // Filter by moderator
        if (moderator) {
            query.moderatorId = moderator;
        }

        // Filter by target user
        if (targetUser) {
            query.targetUserId = targetUser;
        }

        // Filter by date range
        if (startDate || endDate) {
            query.timestamp = {};
            if (startDate) query.timestamp.$gte = new Date(startDate);
            if (endDate) query.timestamp.$lte = new Date(endDate);
        }

        // Search in details or reason
        if (search) {
            query.$or = [
                { reason: { $regex: search, $options: 'i' } },
                { 'details.reason': { $regex: search, $options: 'i' } },
                { ipAddress: { $regex: search, $options: 'i' } }
            ];
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const [logs, total] = await Promise.all([
            AuditLog.find(query)
                .populate('moderatorId', 'personalName breederName email id_public role')
                .populate('targetUserId', 'personalName breederName email id_public')
                .populate('targetAnimalId', 'name id_public')
                .sort({ timestamp: -1 })
                .limit(parseInt(limit))
                .skip(skip)
                .lean(),
            AuditLog.countDocuments(query)
        ]);

        res.json({ logs, total, page: parseInt(page), limit: parseInt(limit) });
    } catch (error) {
        console.error('Error fetching audit logs:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// BACKUP MANAGEMENT ROUTES
// ============================================

// R2 configuration for backups - supports both naming conventions
const getR2Credentials = () => ({
    accessKeyId: process.env.R2_ACCESS_KEY_ID || process.env.CLOUDFLARE_R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
    accountId: process.env.R2_ACCOUNT_ID || process.env.CLOUDFLARE_ACCOUNT_ID,
    bucket: process.env.R2_BUCKET || process.env.R2_BUCKET_NAME
});

const isR2Configured = () => {
    const creds = getR2Credentials();
    return !!(creds.accessKeyId && creds.secretAccessKey && creds.bucket);
};

const getR2Client = () => {
    const { S3Client } = require('@aws-sdk/client-s3');
    const creds = getR2Credentials();
    const endpoint = creds.accountId ? `https://${creds.accountId}.r2.cloudflarestorage.com` : undefined;
    
    return new S3Client({
        region: process.env.R2_REGION || 'auto',
        endpoint: endpoint,
        credentials: creds.accessKeyId && creds.secretAccessKey ? { 
            accessKeyId: creds.accessKeyId, 
            secretAccessKey: creds.secretAccessKey 
        } : undefined,
        forcePathStyle: false,
    });
};

const getR2Bucket = () => getR2Credentials().bucket;
const BACKUP_METADATA_KEY = 'backups/metadata.json';

// Helper: Get backup metadata from R2
const getBackupMetadata = async () => {
    if (!isR2Configured()) {
        console.warn('R2 not configured for backups');
        return { backups: [], lastAutoBackup: null };
    }
    
    try {
        const { GetObjectCommand } = require('@aws-sdk/client-s3');
        const s3Client = getR2Client();
        const command = new GetObjectCommand({ Bucket: getR2Bucket(), Key: BACKUP_METADATA_KEY });
        const response = await s3Client.send(command);
        const bodyString = await response.Body.transformToString();
        return JSON.parse(bodyString);
    } catch (err) {
        if (err.name === 'NoSuchKey' || err.Code === 'NoSuchKey') {
            return { backups: [], lastAutoBackup: null };
        }
        console.error('Error reading backup metadata from R2:', err);
        return { backups: [], lastAutoBackup: null };
    }
};

// Helper: Save backup metadata to R2
const saveBackupMetadata = async (metadata) => {
    if (!isR2Configured()) {
        console.warn('R2 not configured for backups');
        return;
    }
    
    try {
        const { PutObjectCommand } = require('@aws-sdk/client-s3');
        const s3Client = getR2Client();
        const command = new PutObjectCommand({
            Bucket: getR2Bucket(),
            Key: BACKUP_METADATA_KEY,
            Body: JSON.stringify(metadata, null, 2),
            ContentType: 'application/json'
        });
        await s3Client.send(command);
    } catch (err) {
        console.error('Error saving backup metadata to R2:', err);
    }
};

// Helper: Get collection counts
const getCollectionStats = async () => {
    const stats = {
        users: await User.countDocuments(),
        animals: await Animal.countDocuments(),
        publicProfiles: await PublicProfile.countDocuments(),
        publicAnimals: await PublicAnimal.countDocuments(),
        auditLogs: await AuditLog.countDocuments(),
        profileReports: await ProfileReport.countDocuments(),
        animalReports: await AnimalReport.countDocuments(),
        messageReports: await MessageReport.countDocuments(),
        modChats: await ModChat.countDocuments()
    };
    return stats;
};

// GET /api/admin/backups - List available backups (from R2)
router.get('/backups', async (req, res) => {
    try {
        if (!isAdmin(req)) return res.status(403).json({ error: 'Admin only' });

        const metadata = await getBackupMetadata();
        const currentStats = await getCollectionStats();
        
        // Get schedule info
        let scheduleInfo = { schedule: '0 3 * * *', timezone: 'UTC' };
        try {
            const { getScheduleInfo } = require('../utils/backupScheduler');
            scheduleInfo = await getScheduleInfo();
        } catch (err) {
            console.error('Error getting schedule info:', err);
        }
        
        res.json({
            backups: metadata.backups || [],
            lastAutoBackup: metadata.lastAutoBackup,
            currentStats,
            schedule: scheduleInfo
        });
    } catch (error) {
        console.error('Error fetching backups:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/admin/backup-schedule - Get backup schedule info
router.get('/backup-schedule', async (req, res) => {
    try {
        if (!isAdmin(req)) return res.status(403).json({ error: 'Admin only' });

        const { getScheduleInfo } = require('../utils/backupScheduler');
        const scheduleInfo = await getScheduleInfo();
        
        res.json(scheduleInfo);
    } catch (error) {
        console.error('Error getting backup schedule:', error);
        res.status(500).json({ error: error.message });
    }
});

// PUT /api/admin/backup-schedule - Update backup schedule
router.put('/backup-schedule', async (req, res) => {
    try {
        if (!isAdmin(req)) return res.status(403).json({ error: 'Admin only' });

        const { schedule } = req.body;
        
        if (!schedule) {
            return res.status(400).json({ error: 'Schedule is required' });
        }

        const { updateBackupSchedule, getScheduleInfo } = require('../utils/backupScheduler');
        await updateBackupSchedule(schedule);
        
        // Log the change
        await createAuditLog({
            action: 'backup_schedule_updated',
            performedBy: req.user?._id,
            details: { newSchedule: schedule }
        });
        
        res.json({ 
            success: true, 
            message: 'Backup schedule updated',
            schedule: await getScheduleInfo()
        });
    } catch (error) {
        console.error('Error updating backup schedule:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST /api/admin/trigger-backup - Trigger manual backup (uses R2 cloud storage)
router.post('/trigger-backup', async (req, res) => {
    try {
        if (!isAdmin(req)) return res.status(403).json({ error: 'Admin only' });

        const { description, backupType = 'manual' } = req.body;
        
        // Check R2 configuration using local helper
        if (!isR2Configured()) {
            return res.status(500).json({ 
                error: 'R2 storage not configured',
                message: 'Set CLOUDFLARE_R2_ACCESS_KEY_ID, CLOUDFLARE_R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME environment variables'
            });
        }
        
        const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
        const creds = getR2Credentials();
        const s3Client = getR2Client();
        const bucket = creds.bucket;

        const timestamp = new Date();
        const backupId = `backup-${timestamp.toISOString().replace(/:/g, '-').split('.')[0]}`;
        const backupPrefix = `backups/${backupId}`;

        // Get collection stats before backup
        const stats = await getCollectionStats();

        // Export collections to JSON
        const collections = {
            users: await User.find({}).lean(),
            animals: await Animal.find({}).lean(),
            publicProfiles: await PublicProfile.find({}).lean(),
            publicAnimals: await PublicAnimal.find({}).lean()
        };

        let totalSize = 0;
        
        // Upload each collection to R2
        for (const [name, data] of Object.entries(collections)) {
            const jsonData = JSON.stringify(data, null, 2);
            const key = `${backupPrefix}/${name}.json`;
            
            const command = new PutObjectCommand({
                Bucket: bucket,
                Key: key,
                Body: jsonData,
                ContentType: 'application/json'
            });
            await s3Client.send(command);
            totalSize += Buffer.byteLength(jsonData, 'utf8');
        }

        // Create backup info file
        const backupInfo = {
            id: backupId,
            createdAt: timestamp,
            createdBy: req.user?.email || 'system',
            description: description || `${backupType} backup`,
            type: backupType,
            stats,
            collections: Object.keys(collections),
            totalSizeBytes: totalSize,
            storageLocation: 'r2'
        };

        // Upload backup info to R2
        const infoCommand = new PutObjectCommand({
            Bucket: bucket,
            Key: `${backupPrefix}/backup-info.json`,
            Body: JSON.stringify(backupInfo, null, 2),
            ContentType: 'application/json'
        });
        await s3Client.send(infoCommand);

        // Update metadata in R2
        let metadata = { backups: [], lastAutoBackup: null };
        try {
            const getCmd = new GetObjectCommand({ Bucket: bucket, Key: 'backups/metadata.json' });
            const response = await s3Client.send(getCmd);
            const bodyString = await response.Body.transformToString();
            metadata = JSON.parse(bodyString);
        } catch (err) {
            // Metadata doesn't exist yet, use default
        }
        
        metadata.backups.unshift({
            id: backupId,
            createdAt: timestamp,
            createdBy: req.user?.email || 'system',
            description: backupInfo.description,
            type: backupType,
            stats,
            totalSizeBytes: totalSize,
            status: 'completed',
            storageLocation: 'r2'
        });

        // Keep only last 30 backups in metadata
        if (metadata.backups.length > 30) {
            metadata.backups = metadata.backups.slice(0, 30);
        }

        // Save updated metadata
        const metaCmd = new PutObjectCommand({
            Bucket: bucket,
            Key: 'backups/metadata.json',
            Body: JSON.stringify(metadata, null, 2),
            ContentType: 'application/json'
        });
        await s3Client.send(metaCmd);

        // Log the action
        await createAuditLog({
            action: 'backup_created',
            performedBy: req.user?._id,
            details: { backupId, type: backupType, stats, storage: 'r2' }
        });

        res.json({
            success: true,
            message: 'Backup created successfully in R2 cloud storage',
            backup: metadata.backups[0]
        });
    } catch (error) {
        console.error('Error creating backup:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/admin/backups/:backupId - Get backup details from R2
router.get('/backups/:backupId', async (req, res) => {
    try {
        if (!isAdmin(req)) return res.status(403).json({ error: 'Admin only' });

        const { backupId } = req.params;
        
        if (!isR2Configured()) {
            return res.status(500).json({ error: 'R2 storage not configured' });
        }
        
        const { GetObjectCommand } = require('@aws-sdk/client-s3');
        const s3Client = getR2Client();
        
        try {
            const command = new GetObjectCommand({
                Bucket: getR2Bucket(),
                Key: `backups/${backupId}/backup-info.json`
            });
            const response = await s3Client.send(command);
            const bodyString = await response.Body.transformToString();
            const backupInfo = JSON.parse(bodyString);
            res.json(backupInfo);
        } catch (err) {
            if (err.name === 'NoSuchKey' || err.Code === 'NoSuchKey') {
                return res.status(404).json({ error: 'Backup not found' });
            }
            throw err;
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/admin/backups/:backupId/download - Download backup from R2
router.get('/backups/:backupId/download', async (req, res) => {
    try {
        if (!isAdmin(req)) return res.status(403).json({ error: 'Admin only' });

        const { backupId } = req.params;
        
        if (!isR2Configured()) {
            return res.status(500).json({ error: 'R2 storage not configured' });
        }
        
        const { GetObjectCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3');
        const s3Client = getR2Client();
        
        // List all files in this backup
        const listCommand = new ListObjectsV2Command({
            Bucket: getR2Bucket(),
            Prefix: `backups/${backupId}/`
        });
        const listResponse = await s3Client.send(listCommand);
        
        if (!listResponse.Contents || listResponse.Contents.length === 0) {
            return res.status(404).json({ error: 'Backup not found' });
        }
        
        const backup = {};
        
        for (const obj of listResponse.Contents) {
            if (obj.Key.endsWith('.json')) {
                const getCommand = new GetObjectCommand({
                    Bucket: getR2Bucket(),
                    Key: obj.Key
                });
                const response = await s3Client.send(getCommand);
                const bodyString = await response.Body.transformToString();
                const fileName = obj.Key.split('/').pop().replace('.json', '');
                backup[fileName] = JSON.parse(bodyString);
            }
        }

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="${backupId}.json"`);
        res.json(backup);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE /api/admin/backups/:backupId - Delete a backup from R2
router.delete('/backups/:backupId', async (req, res) => {
    try {
        if (!isAdmin(req)) return res.status(403).json({ error: 'Admin only' });

        const { backupId } = req.params;
        
        if (!isR2Configured()) {
            return res.status(500).json({ error: 'R2 storage not configured' });
        }
        
        const { ListObjectsV2Command, DeleteObjectCommand } = require('@aws-sdk/client-s3');
        const s3Client = getR2Client();
        
        // List all files in this backup
        const listCommand = new ListObjectsV2Command({
            Bucket: getR2Bucket(),
            Prefix: `backups/${backupId}/`
        });
        const listResponse = await s3Client.send(listCommand);
        
        if (!listResponse.Contents || listResponse.Contents.length === 0) {
            return res.status(404).json({ error: 'Backup not found' });
        }
        
        // Delete all files in the backup
        for (const obj of listResponse.Contents) {
            const deleteCommand = new DeleteObjectCommand({
                Bucket: getR2Bucket(),
                Key: obj.Key
            });
            await s3Client.send(deleteCommand);
        }

        // Update metadata
        const metadata = await getBackupMetadata();
        metadata.backups = metadata.backups.filter(b => b.id !== backupId);
        await saveBackupMetadata(metadata);

        // Log the action
        await createAuditLog({
            action: 'backup_deleted',
            performedBy: req.user?._id,
            details: { backupId }
        });

        res.json({ success: true, message: 'Backup deleted from R2 storage' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/admin/restore-backup/:backupId - Restore from backup (DANGEROUS) - reads from R2
router.post('/restore-backup/:backupId', async (req, res) => {
    try {
        if (!isAdmin(req)) return res.status(403).json({ error: 'Admin only' });

        const { backupId } = req.params;
        const { collections = [], confirmRestore } = req.body;

        if (!confirmRestore) {
            return res.status(400).json({ 
                error: 'Restore requires confirmation',
                message: 'Set confirmRestore: true to proceed. This will overwrite existing data!'
            });
        }

        if (!isR2Configured()) {
            return res.status(500).json({ error: 'R2 storage not configured' });
        }
        
        const { GetObjectCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3');
        const s3Client = getR2Client();
        
        // List all files in this backup
        const listCommand = new ListObjectsV2Command({
            Bucket: getR2Bucket(),
            Prefix: `backups/${backupId}/`
        });
        const listResponse = await s3Client.send(listCommand);
        
        if (!listResponse.Contents || listResponse.Contents.length === 0) {
            return res.status(404).json({ error: 'Backup not found' });
        }

        const restored = [];
        const errors = [];

        // Restore specified collections (or all if none specified)
        const collectionMap = {
            users: User,
            animals: Animal,
            publicProfiles: PublicProfile,
            publicAnimals: PublicAnimal
        };

        for (const [name, Model] of Object.entries(collectionMap)) {
            if (collections.length > 0 && !collections.includes(name)) continue;

            const key = `backups/${backupId}/${name}.json`;
            
            // Check if this collection exists in the backup
            const exists = listResponse.Contents.some(obj => obj.Key === key);
            if (!exists) continue;

            try {
                const getCommand = new GetObjectCommand({
                    Bucket: getR2Bucket(),
                    Key: key
                });
                const response = await s3Client.send(getCommand);
                const bodyString = await response.Body.transformToString();
                const data = JSON.parse(bodyString);
                
                // Clear existing data and insert backup data
                await Model.deleteMany({});
                if (data.length > 0) {
                    await Model.insertMany(data, { ordered: false });
                }
                
                restored.push({ collection: name, count: data.length });
            } catch (err) {
                errors.push({ collection: name, error: err.message });
            }
        }

        // Log the action
        await createAuditLog({
            action: 'backup_restored',
            performedBy: req.user?._id,
            details: { backupId, restored, errors }
        });

        res.json({
            success: true,
            message: 'Restore completed from R2 backup',
            restored,
            errors: errors.length > 0 ? errors : undefined
        });
    } catch (error) {
        console.error('Error restoring backup:', error);
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
        if (status && ['pending', 'reviewed', 'resolved', 'dismissed'].includes(status)) {
            filter.status = status;
        }

        // Fetch all three types of reports
        const [profileReports, animalReports, messageReports] = await Promise.all([
            ProfileReport.find(filter)
                .populate('reporterId', 'email personalName id_public')
                .populate('reportedUserId', 'email personalName breederName id_public')
                .populate('reviewedBy', 'email personalName id_public')
                .sort(sort)
                .lean(),
            AnimalReport.find(filter)
                .populate('reporterId', 'email personalName id_public')
                .populate('reportedAnimalId', 'name id_public species gender ownerId')
                .populate('reviewedBy', 'email personalName id_public')
                .sort(sort)
                .lean(),
            MessageReport.find(filter)
                .populate('reporterId', 'email personalName id_public')
                .populate('reportedUserId', 'email personalName breederName id_public')
                .populate('messageId', 'message senderId receiverId')
                .populate('reviewedBy', 'email personalName id_public')
                .sort(sort)
                .lean()
        ]);

        // Normalize reports to common format
        const normalizedReports = [
            ...profileReports.map(r => ({
                ...r,
                reportType: 'profile',
                contentType: 'profile',
                contentId: r.reportedUserId?._id,
                contentOwnerId: r.reportedUserId,
                contentDetails: {
                    name: r.reportedUserId?.personalName || r.reportedUserId?.breederName,
                    id_public: r.reportedUserId?.id_public,
                    email: r.reportedUserId?.email
                }
            })),
            ...animalReports.map(r => ({
                ...r,
                reportType: 'animal',
                contentType: 'animal',
                contentId: r.reportedAnimalId?._id,
                contentOwnerId: r.reportedAnimalId?.ownerId,
                contentDetails: {
                    name: r.reportedAnimalId?.name,
                    id_public: r.reportedAnimalId?.id_public,
                    species: r.reportedAnimalId?.species,
                    gender: r.reportedAnimalId?.gender
                }
            })),
            ...messageReports.map(r => ({
                ...r,
                reportType: 'message',
                contentType: 'message',
                contentId: r.messageId?._id,
                contentOwnerId: r.reportedUserId,
                contentDetails: {
                    message: r.messageId?.message,
                    senderId: r.messageId?.senderId,
                    receiverId: r.messageId?.receiverId
                }
            }))
        ];

        // Sort combined results
        normalizedReports.sort((a, b) => {
            const dateA = new Date(a.createdAt);
            const dateB = new Date(b.createdAt);
            return sort.startsWith('-') ? dateB - dateA : dateA - dateB;
        });

        // Apply pagination
        const paginatedReports = normalizedReports.slice(parseInt(skip), parseInt(skip) + parseInt(limit));

        res.json({
            reports: paginatedReports,
            total: normalizedReports.length,
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
        const { status, moderatorNotes, reportType } = req.body;

        // Validate status
        const validStatuses = ['pending', 'reviewed', 'resolved', 'dismissed'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }

        // Determine which model to use
        const ReportModel = reportType === 'profile' ? ProfileReport :
                           reportType === 'animal' ? AnimalReport :
                           reportType === 'message' ? MessageReport : null;
        
        if (!ReportModel) {
            return res.status(400).json({ error: 'Invalid report type. Must be profile, animal, or message' });
        }

        // Update report
        const report = await ReportModel.findByIdAndUpdate(
            reportId,
            {
                status,
                reviewedBy: req.user.id,
                adminNotes: moderatorNotes || '',
                reviewedAt: ['resolved', 'dismissed'].includes(status) ? new Date() : null
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
        const { action, reason, replacementText, reportType } = req.body;
        
        // Ban is admin only
        if (action === 'ban_user' && !isAdmin(req)) {
            return res.status(403).json({ error: 'Only admins can ban users' });
        }

        const validActions = ['remove_content', 'replace_content', 'warn_user', 'suspend_user', 'ban_user'];
        if (!validActions.includes(action)) {
            return res.status(400).json({ error: 'Invalid action' });
        }

        // Determine which model to use
        const ReportModel = reportType === 'profile' ? ProfileReport :
                           reportType === 'animal' ? AnimalReport :
                           reportType === 'message' ? MessageReport : null;
        
        if (!ReportModel) {
            return res.status(400).json({ error: 'Invalid report type' });
        }

        // Get the report
        const report = await ReportModel.findById(reportId);
        if (!report) {
            return res.status(404).json({ error: 'Report not found' });
        }
        
        // Get content owner ID based on report type
        const contentOwnerId = reportType === 'profile' ? report.reportedUserId :
                              reportType === 'animal' ? (await Animal.findById(report.reportedAnimalId).select('ownerId'))?.ownerId :
                              reportType === 'message' ? report.reportedUserId : null;

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
                if (contentOwnerId) {
                    const user = await User.findByIdAndUpdate(
                        contentOwnerId,
                        { $inc: { warningCount: 1 } },
                        { new: true }
                    );
                    if (user && user.warningCount >= 3) {
                        // Auto-suspend after 3 warnings
                        await User.findByIdAndUpdate(contentOwnerId, { accountStatus: 'suspended' });
                    }
                }
                break;

            case 'suspend_user':
                if (contentOwnerId) {
                    await User.findByIdAndUpdate(contentOwnerId, {
                        accountStatus: 'suspended',
                        suspensionReason: reason || 'Community guideline violation',
                        moderatedBy: req.user.id
                    });
                }
                break;

            case 'ban_user':
                if (contentOwnerId) {
                    await User.findByIdAndUpdate(contentOwnerId, {
                        accountStatus: 'banned',
                        banReason: reason || 'Serious community guideline violation',
                        moderatedBy: req.user.id
                    });
                }
                break;
        }

        // Update report with action taken
        await ReportModel.findByIdAndUpdate(reportId, {
            status: 'resolved',
            adminNotes: reason || `Action: ${action}`,
            reviewedBy: req.user.id,
            reviewedAt: new Date()
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
            targetName: `${animal.name} (${animal.id_public || 'No ID'})`,
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
            targetName: `${animalData.name} (${animalData.id_public || 'No ID'})`,
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
            targetName: `${user.email} (${user.id_public || 'No ID'})`,
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
            recipients = await User.find({ _id: { $in: specificUserIds } }).select('_id email personalName id_public');
        } else if (recipientType === 'all') {
            recipients = await User.find({}).select('_id email personalName id_public');
        } else if (recipientType === 'active') {
            const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
            recipients = await User.find({ last_login: { $gte: thirtyDaysAgo } }).select('_id email personalName id_public');
        } else if (recipientType === 'moderators') {
            recipients = await User.find({ role: { $in: ['moderator', 'admin'] } }).select('_id email personalName id_public');
        } else if (recipientType === 'country' && req.body.country) {
            recipients = await User.find({ country: req.body.country }).select('_id email personalName id_public');
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
            return res.status(400).json({ error: 'User CTUID and message required' });
        }

        const { Notification, User } = require('../database/models');
        
        // Look up user by CTUID (id_public)
        const targetUser = await User.findOne({ id_public: userId.toUpperCase() });
        if (!targetUser) {
            return res.status(404).json({ error: `User not found with CTUID: ${userId}` });
        }
        
        await Notification.create({
            userId: targetUser._id,
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
            targetId: targetUser._id,
            targetName: targetUser.id_public,
            details: { messageLength: message.length, targetCTUID: targetUser.id_public },
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
        // Map some keys for frontend compatibility
        const keyMapping = {
            'maintenance_mode_enabled': 'maintenance_mode',
            'maintenance_mode_message': 'maintenance_message'
        };
        
        const settingsObj = {};
        settings.forEach(setting => {
            const key = keyMapping[setting.key] || setting.key;
            settingsObj[key] = {
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

// =============================================
// MOD CHAT ENDPOINTS
// =============================================

// GET /api/admin/mod-chat - Get mod chat messages
router.get('/mod-chat', async (req, res) => {
    try {
        if (!isModerator(req)) return res.status(403).json({ error: 'Moderator only' });

        const { limit = 50, before } = req.query;

        const query = { isDeleted: false };
        if (before) {
            query.createdAt = { $lt: new Date(before) };
        }

        const messages = await ModChat.find(query)
            .populate('senderId', 'email personalName role id_public')
            .sort({ createdAt: -1 })
            .limit(parseInt(limit))
            .lean();

        // Return in chronological order (oldest first)
        res.json({
            messages: messages.reverse(),
            hasMore: messages.length === parseInt(limit)
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/admin/mod-chat - Send a mod chat message
router.post('/mod-chat', async (req, res) => {
    try {
        if (!isModerator(req)) return res.status(403).json({ error: 'Moderator only' });

        const { message } = req.body;

        if (!message || message.trim().length === 0) {
            return res.status(400).json({ error: 'Message is required' });
        }

        if (message.length > 2000) {
            return res.status(400).json({ error: 'Message too long (max 2000 characters)' });
        }

        const newMessage = await ModChat.create({
            senderId: req.user.id,
            message: message.trim()
        });

        // Populate sender info for response
        const populatedMessage = await ModChat.findById(newMessage._id)
            .populate('senderId', 'email personalName role id_public')
            .lean();

        res.json({
            success: true,
            message: populatedMessage
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE /api/admin/mod-chat/:messageId - Delete a mod chat message (own messages only, or admin can delete any)
router.delete('/mod-chat/:messageId', async (req, res) => {
    try {
        if (!isModerator(req)) return res.status(403).json({ error: 'Moderator only' });

        const { messageId } = req.params;

        const message = await ModChat.findById(messageId);
        if (!message) {
            return res.status(404).json({ error: 'Message not found' });
        }

        // Only the sender or an admin can delete
        if (message.senderId.toString() !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'You can only delete your own messages' });
        }

        message.isDeleted = true;
        message.deletedAt = new Date();
        await message.save();

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
