const { AuditLog } = require('../database/models');

/**
 * Creates an audit log entry for moderation actions
 * @param {Object} params - Audit log parameters
 * @param {String} params.moderatorId - MongoDB ID of the moderator
 * @param {String} params.moderatorEmail - Email of the moderator
 * @param {String} params.action - Action type (e.g., 'user_suspended')
 * @param {String} params.targetType - Type of target (e.g., 'user', 'animal')
 * @param {String} params.targetId - MongoDB ID of the target
 * @param {String} params.targetName - Human-readable identifier (email, name, etc.)
 * @param {Object} params.details - Additional details about the action
 * @param {String} params.reason - Reason provided for the action
 * @param {String} params.ipAddress - IP address of the moderator
 * @param {String} params.userAgent - User agent of the moderator
 */
async function createAuditLog({
    moderatorId,
    moderatorEmail,
    action,
    targetType,
    targetId,
    targetName = null,
    details = {},
    reason = null,
    ipAddress = null,
    userAgent = null
}) {
    try {
        // Set specific target fields based on targetType for proper population
        const targetUserId = targetType?.toLowerCase() === 'user' ? targetId : null;
        const targetAnimalId = targetType?.toLowerCase() === 'animal' ? targetId : null;
        
        const auditEntry = new AuditLog({
            moderatorId,
            moderatorEmail,
            action,
            targetType,
            targetId,
            targetUserId,
            targetAnimalId,
            targetName,
            details,
            reason,
            ipAddress,
            userAgent
        });

        await auditEntry.save();
        console.log(`[AUDIT] ${action} by ${moderatorEmail} on ${targetType}:${targetId}`);
        
        return auditEntry;
    } catch (error) {
        console.error('Failed to create audit log:', error);
        // Don't throw - we don't want audit logging failures to break operations
        return null;
    }
}

/**
 * Gets audit logs with filtering and pagination
 * @param {Object} filters - Query filters
 * @param {Object} options - Pagination and sorting options
 */
async function getAuditLogs(filters = {}, options = {}) {
    const {
        moderatorId,
        action,
        targetType,
        targetId,
        startDate,
        endDate
    } = filters;

    const {
        limit = 100,
        skip = 0,
        sort = '-createdAt'
    } = options;

    const query = {};

    if (moderatorId) query.moderatorId = moderatorId;
    if (action) query.action = action;
    if (targetType) query.targetType = targetType;
    if (targetId) query.targetId = targetId;
    
    if (startDate || endDate) {
        query.createdAt = {};
        if (startDate) query.createdAt.$gte = new Date(startDate);
        if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const logs = await AuditLog.find(query)
        .populate('moderatorId', 'email personalName id_public')
        .sort(sort)
        .limit(parseInt(limit))
        .skip(parseInt(skip))
        .lean();

    const total = await AuditLog.countDocuments(query);

    return {
        logs,
        total,
        limit: parseInt(limit),
        skip: parseInt(skip)
    };
}

module.exports = {
    createAuditLog,
    getAuditLogs
};
