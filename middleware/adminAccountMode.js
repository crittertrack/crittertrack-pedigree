const jwt = require('jsonwebtoken');
const { AdminAccountSession, AuditLog, User } = require('../database/models');

const JWT_SECRET = process.env.JWT_SECRET || 'your_default_jwt_secret_please_change_me';

const adminAccountModeMiddleware = async (req, res, next) => {
    const authorization = req.get('Authorization') || '';
    if (!authorization.startsWith('Bearer ')) return next();

    let decoded;
    try {
        decoded = jwt.verify(authorization.slice(7), JWT_SECRET);
    } catch (error) {
        if (error.name === 'TokenExpiredError' && jwt.decode(authorization.slice(7))?.adminAccountMode) {
            return res.status(401).json({
                message: 'Admin account session expired.',
                adminAccountSessionExpired: true,
            });
        }
        return next();
    }

    const context = decoded.adminAccountMode;
    if (!context) return next();
    if (!context.sessionId || !context.adminUserId || !context.targetUserId) {
        return res.status(401).json({ message: 'Invalid admin account session.', adminAccountSessionExpired: true });
    }

    try {
        const session = await AdminAccountSession.findOne({
            _id: context.sessionId,
            adminUserId: context.adminUserId,
            targetUserId: context.targetUserId,
            status: 'active',
            expiresAt: { $gt: new Date() },
        });
        if (!session) {
            return res.status(401).json({ message: 'Admin account session ended or expired.', adminAccountSessionExpired: true });
        }

        const [admin, target] = await Promise.all([
            User.findById(session.adminUserId).select('email role accountStatus'),
            User.findById(session.targetUserId).select('email personalName breederName id_public role accountStatus'),
        ]);
        if (!admin || admin.role !== 'admin' || admin.accountStatus !== 'normal' || !target ||
            target.role !== 'user' || target.accountStatus !== 'normal') {
            return res.status(401).json({ message: 'Admin account session is no longer valid.', adminAccountSessionExpired: true });
        }

        req.adminAccountSession = session;
        req.adminAccountTarget = target;

        const auditEntry = await AuditLog.create({
            moderatorId: admin._id,
            moderatorEmail: admin.email,
            action: 'admin_account_api_request',
            targetType: 'User',
            targetId: target._id,
            targetUserId: target._id,
            targetName: `${target.personalName || target.breederName || target.email} (${target.id_public || target._id})`,
            reason: session.reason,
            ipAddress: req.ip || req.headers['x-forwarded-for'] || req.connection?.remoteAddress || null,
            userAgent: req.get('user-agent') || null,
            details: {
                accountSessionId: session._id,
                method: req.method,
                path: req.originalUrl.split('?')[0],
                outcome: 'in_progress',
            },
        });

        res.on('finish', () => {
            AuditLog.updateOne(
                { _id: auditEntry._id },
                { $set: {
                    'details.statusCode': res.statusCode,
                    'details.outcome': res.statusCode < 400 ? 'success' : 'failure',
                } }
            ).catch(error => {
                console.error('Failed to finalize admin account audit entry:', error);
            });
        });

        return next();
    } catch (error) {
        console.error('Failed to validate or audit admin account session:', error);
        return res.status(503).json({ message: 'Could not validate or audit admin account session. Request was not processed.' });
    }
};

module.exports = adminAccountModeMiddleware;
