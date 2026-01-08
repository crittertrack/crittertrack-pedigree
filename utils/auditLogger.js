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
        console.log(`[AUDIT LOG] Creating audit log: action=${action}, moderator=${moderatorEmail}, targetType=${targetType}`);
        
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

        console.log(`[AUDIT LOG] Audit entry created, saving to database...`);
        const savedEntry = await auditEntry.save();
        console.log(`[AUDIT LOG] ✅ Successfully saved audit log: ${action} by ${moderatorEmail}`);
        
        return savedEntry;
    } catch (error) {
        console.error(`[AUDIT LOG] ❌ FAILED to create audit log:`, error.message);
        console.error(`[AUDIT LOG] Error stack:`, error.stack);
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
        .populate('moderatorId', 'email personalName breederName id_public')
        .populate('targetUserId', 'email personalName breederName id_public')
        .populate('targetAnimalId', 'name id_public')
        .sort(sort)
        .limit(parseInt(limit))
        .skip(parseInt(skip))
        .lean()
        .exec();
    
    // Ensure createdAt is included in response
    const logsWithTimestamp = logs.map(log => ({
        ...log,
        createdAt: log.createdAt || (log._id && log._id.getTimestamp ? log._id.getTimestamp() : new Date())
    }));

    const total = await AuditLog.countDocuments(query);

    return {
        logs: logsWithTimestamp,
        total,
        limit: parseInt(limit),
        skip: parseInt(skip)
    };
}

module.exports = {
    createAuditLog,
    getAuditLogs
};
