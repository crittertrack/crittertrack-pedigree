const express = require('express');
const router = express.Router();
const { ProfileReport, AnimalReport, MessageReport, User, Animal, Message } = require('../database/models');
const { protect } = require('../middleware/authMiddleware');
const { sanitizeText } = require('../utils/profanityFilter');
const { createAuditLog } = require('../utils/auditLogger');
const mongoose = require('mongoose');

const normalizePublicId = (value = '', prefix) => {
    if (!value || !prefix) return null;
    const trimmed = value.toString().trim().toUpperCase();
    if (!trimmed) return null;
    if (trimmed.startsWith(prefix)) return trimmed;
    if (trimmed.startsWith('CT')) return `${prefix}${trimmed.replace(/^CT[CU]?/i, '')}`;
    return `${prefix}${trimmed.replace(/[^0-9]/g, '') || trimmed}`;
};

const isObjectId = (candidate) => mongoose.Types.ObjectId.isValid(candidate);

// POST /api/reports/profile - Report a user profile
router.post('/profile', protect, async (req, res) => {
    try {
        const reporterId = req.user.id;
        const { reportedUserId, reportedUserPublicId, reason, isModeratorReport } = req.body;
        const trimmedReason = typeof reason === 'string' ? reason.trim() : '';

        console.log('[REPORT PROFILE] Received profile report:', { reporterId, reportedUserId, reportedUserPublicId, reason: trimmedReason });

        if ((!reportedUserId && !reportedUserPublicId) || !trimmedReason) {
            return res.status(400).json({ error: 'reportedUserId (or reportedUserPublicId) and reason are required' });
        }

        const cleanReason = sanitizeText(trimmedReason);

        let targetUser = null;
        if (reportedUserId && isObjectId(reportedUserId)) {
            targetUser = await User.findById(reportedUserId);
        }

        if (!targetUser && reportedUserPublicId) {
            const normalized = normalizePublicId(reportedUserPublicId, 'CTU');
            if (normalized) {
                targetUser = await User.findOne({ id_public: normalized });
            }
        }

        if (!targetUser) {
            console.log('[REPORT PROFILE] User not found:', { reportedUserId, reportedUserPublicId });
            return res.status(404).json({ error: 'User to be reported not found' });
        }

        const report = new ProfileReport({
            reporterId,
            reportedUserId: targetUser._id,
            reason: cleanReason
        });

        await report.save();

        // Create audit log if this is a moderator report from mod tools
        if (isModeratorReport && ['admin', 'moderator'].includes(req.user.role)) {
            await createAuditLog({
                moderatorId: reporterId,
                moderatorEmail: req.user.email,
                action: 'report_created',
                targetType: 'user',
                targetId: targetUser._id,
                targetUserId: targetUser._id,
                targetName: targetUser.personalName || targetUser.breederName || targetUser.email,
                reason: cleanReason,
                details: { reportType: 'profile', reportId: report._id.toString() },
                ipAddress: req.ip || req.headers['x-forwarded-for']
            });
        }

        console.log('[REPORT PROFILE] Report saved successfully:', { reportId: report._id, reporterId, reportedUserId: targetUser._id });

        res.status(201).json({ message: 'Profile report submitted successfully' });
    } catch (error) {
        console.error('[REPORT PROFILE] Error reporting profile:', error);
        res.status(500).json({ error: 'Failed to submit profile report' });
    }
});

// POST /api/reports/animal - Report an animal profile
router.post('/animal', protect, async (req, res) => {
    try {
        const reporterId = req.user.id;
        const { reportedAnimalId, reportedAnimalPublicId, reason, isModeratorReport } = req.body;
        const trimmedReason = typeof reason === 'string' ? reason.trim() : '';

        console.log('[REPORT ANIMAL] Received animal report:', { reporterId, reportedAnimalId, reportedAnimalPublicId, reason: trimmedReason });

        if ((!reportedAnimalId && !reportedAnimalPublicId) || !trimmedReason) {
            return res.status(400).json({ error: 'reportedAnimalId (or reportedAnimalPublicId) and reason are required' });
        }

        const cleanReason = sanitizeText(trimmedReason);

        let targetAnimal = null;
        if (reportedAnimalId && isObjectId(reportedAnimalId)) {
            targetAnimal = await Animal.findById(reportedAnimalId);
        }

        if (!targetAnimal && reportedAnimalPublicId) {
            const normalized = normalizePublicId(reportedAnimalPublicId, 'CTC');
            if (normalized) {
                targetAnimal = await Animal.findOne({ id_public: normalized });
            }
        }

        if (!targetAnimal) {
            console.log('[REPORT ANIMAL] Animal not found:', { reportedAnimalId, reportedAnimalPublicId });
            return res.status(404).json({ error: 'Animal to be reported not found' });
        }

        const report = new AnimalReport({
            reporterId,
            reportedAnimalId: targetAnimal._id,
            reason: cleanReason
        });

        await report.save();

        // Create audit log if this is a moderator report from mod tools
        if (isModeratorReport && ['admin', 'moderator'].includes(req.user.role)) {
            await createAuditLog({
                moderatorId: reporterId,
                moderatorEmail: req.user.email,
                action: 'report_created',
                targetType: 'animal',
                targetId: targetAnimal._id,
                targetAnimalId: targetAnimal._id,
                targetName: targetAnimal.name || targetAnimal.id_public,
                reason: cleanReason,
                details: { reportType: 'animal', reportId: report._id.toString() },
                ipAddress: req.ip || req.headers['x-forwarded-for']
            });
        }

        console.log('[REPORT ANIMAL] Report saved successfully:', { reportId: report._id, reporterId, reportedAnimalId: targetAnimal._id });

        res.status(201).json({ message: 'Animal report submitted successfully' });
    } catch (error) {
        console.error('[REPORT ANIMAL] Error reporting animal:', error);
        res.status(500).json({ error: 'Failed to submit animal report' });
    }
});

// POST /api/reports/message - Report a message or conversation
router.post('/message', protect, async (req, res) => {
    try {
        const reporterId = req.user.id;
        const { messageId, reportedUserId, conversationUserId, reason, recentMessages, isModeratorReport } = req.body;
        const trimmedReason = typeof reason === 'string' ? reason.trim() : '';

        console.log('[REPORT MESSAGE] Received report:', { reporterId, messageId, reportedUserId, conversationUserId, reason: trimmedReason, recentMessagesCount: recentMessages?.length });

        if (!trimmedReason) {
            return res.status(400).json({ error: 'reason is required' });
        }

        const cleanReason = sanitizeText(trimmedReason);

        // Conversation report (with recentMessages array)
        if (recentMessages && Array.isArray(recentMessages) && recentMessages.length > 0) {
            // Find the reported user
            let targetUserId = reportedUserId || conversationUserId;
            let targetUser = null;
            
            if (targetUserId && isObjectId(targetUserId)) {
                targetUser = await User.findById(targetUserId);
            }
            
            if (!targetUser) {
                return res.status(404).json({ error: 'Reported user not found' });
            }

            const report = new MessageReport({
                reporterId,
                reportedUserId: targetUser._id,
                reportType: 'conversation',
                conversationMessages: recentMessages.map(msg => ({
                    messageId: msg.messageId,
                    senderId: msg.senderId,
                    message: msg.message,
                    createdAt: msg.createdAt
                })),
                reason: cleanReason
            });

            await report.save();

            // Create audit log if this is a moderator report from mod tools
            if (isModeratorReport && ['admin', 'moderator'].includes(req.user.role)) {
                await createAuditLog({
                    moderatorId: reporterId,
                    moderatorEmail: req.user.email,
                    action: 'report_created',
                    targetType: 'user',
                    targetId: targetUser._id,
                    targetUserId: targetUser._id,
                    targetName: targetUser.personalName || targetUser.breederName || targetUser.email,
                    reason: cleanReason,
                    details: { reportType: 'conversation', reportId: report._id.toString() },
                    ipAddress: req.ip || req.headers['x-forwarded-for']
                });
            }

            console.log('[REPORT MESSAGE] Conversation report saved:', { reportId: report._id, messagesCount: recentMessages.length });
            return res.status(201).json({ message: 'Conversation report submitted successfully' });
        }

        // Single message report
        if (!messageId) {
            return res.status(400).json({ error: 'messageId or recentMessages is required' });
        }

        const message = await Message.findById(messageId);
        if (!message) {
            return res.status(404).json({ error: 'Message not found' });
        }

        // Verify reporter is part of the conversation
        if (message.senderId.toString() !== reporterId && message.receiverId.toString() !== reporterId) {
            return res.status(403).json({ error: 'Not authorized to report this message' });
        }

        // The user being reported is the other person in the conversation
        const finalReportedUserId = reportedUserId || (message.senderId.toString() === reporterId ? message.receiverId : message.senderId);

        const report = new MessageReport({
            reporterId,
            reportedUserId: finalReportedUserId,
            messageId,
            reportType: 'message',
            reason: cleanReason
        });

        await report.save();
        console.log('[REPORT MESSAGE] Single message report saved:', { reportId: report._id, messageId });

        res.status(201).json({ message: 'Message report submitted successfully' });
    } catch (error) {
        console.error('[REPORT MESSAGE] Error reporting message:', error);
        res.status(500).json({ error: 'Failed to submit message report' });
    }
});

module.exports = router;
