const express = require('express');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { checkRole } = require('../middleware/authMiddleware');
const { AdminAccountSession, AuditLog, User } = require('../database/models');

const router = express.Router();
const requireAdmin = checkRole(['admin']);
const JWT_SECRET = process.env.JWT_SECRET || 'your_default_jwt_secret_please_change_me';
const SESSION_LIFETIME_MS = 30 * 60 * 1000;

router.post('/start', requireAdmin, async (req, res) => {
    let proof;
    try {
        proof = jwt.verify(req.body?.moderationProofToken, JWT_SECRET);
    } catch {
        return res.status(403).json({ message: 'Verify your moderation password before starting an account session.' });
    }
    if (proof.type !== 'moderation-proof' || proof.userId !== String(req.user.id) ||
        (!proof.moderationPasswordVerified && !proof.twoFactorVerified)) {
        return res.status(403).json({ message: 'A valid, recent moderation verification is required.' });
    }
    const targetUserId = req.body?.targetUserId;
    const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
    if (!mongoose.isValidObjectId(targetUserId)) {
        return res.status(400).json({ message: 'A valid target user ID is required.' });
    }
    if (reason.length < 10 || reason.length > 1000) {
        return res.status(400).json({ message: 'Provide a reason between 10 and 1000 characters.' });
    }

    try {
        const adminId = req.user.id || req.user._id;
        if (String(adminId) === String(targetUserId)) {
            return res.status(400).json({ message: 'You cannot start an account session for your own account.' });
        }

        const [admin, target] = await Promise.all([
            User.findById(adminId).select('email role accountStatus personalName'),
            User.findById(targetUserId).select('email personalName breederName id_public role accountStatus'),
        ]);
        if (!admin || admin.role !== 'admin' || admin.accountStatus !== 'normal') {
            return res.status(403).json({ message: 'An active administrator account is required.' });
        }
        if (!target || target.role !== 'user' || target.accountStatus !== 'normal') {
            return res.status(400).json({ message: 'Only active, non-staff user accounts can be opened.' });
        }

        const expiresAt = new Date(Date.now() + SESSION_LIFETIME_MS);
        const session = await AdminAccountSession.create({
            adminUserId: admin._id,
            targetUserId: target._id,
            reason,
            expiresAt,
        });

        try {
            await AuditLog.create({
                moderatorId: admin._id,
                moderatorEmail: admin.email,
                action: 'admin_account_session_started',
                targetType: 'User',
                targetId: target._id,
                targetUserId: target._id,
                targetName: `${target.personalName || target.breederName || target.email} (${target.id_public || target._id})`,
                reason,
                ipAddress: req.ip || req.headers['x-forwarded-for'] || req.connection?.remoteAddress || null,
                userAgent: req.get('user-agent') || null,
                details: { accountSessionId: session._id, expiresAt },
            });
        } catch (error) {
            await AdminAccountSession.deleteOne({ _id: session._id });
            throw error;
        }

        const token = jwt.sign({
            user: { id: target._id.toString() },
            type: 'admin-account',
            adminAccountMode: {
                sessionId: session._id.toString(),
                adminUserId: admin._id.toString(),
                targetUserId: target._id.toString(),
            },
        }, JWT_SECRET, { expiresIn: '30m' });

        return res.json({
            token,
            session: {
                id: session._id,
                expiresAt,
                adminName: admin.personalName || admin.email,
                targetName: target.personalName || target.breederName || target.email,
                targetId: target.id_public,
            },
        });
    } catch (error) {
        console.error('Failed to start admin account session:', error);
        return res.status(500).json({ message: 'Failed to start audited admin account session.' });
    }
});

router.post('/end', async (req, res) => {
    const session = req.adminAccountSession;
    if (!session) return res.status(403).json({ message: 'No active admin account session.' });

    try {
        session.status = 'ended';
        session.endedAt = new Date();
        await session.save();
        return res.json({ message: 'Admin account session ended.' });
    } catch (error) {
        console.error('Failed to end admin account session:', error);
        return res.status(500).json({ message: 'Failed to end admin account session.' });
    }
});

module.exports = router;
