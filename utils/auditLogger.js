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
 * @param {Boolean} params.success - Whether the action succeeded (default: true)
 * @param {String} params.errorMessage - Error message if action failed
 * @param {String} params.errorCode - Error code/type for categorization
 * @param {String} params.targetAnimalId - Optional explicit animal ID for report-type actions
 * @param {String} params.targetUserId - Optional explicit user ID for report-type actions
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
    userAgent = null,
    success = true,
    errorMessage = null,
    errorCode = null,
    targetAnimalId: explicitAnimalId = null,
    targetUserId: explicitUserId = null
}) {
    try {
        const logLevel = success ? 'INFO' : 'ERROR';
        console.log(`[AUDIT LOG] [${logLevel}] Creating audit log: action=${action}, moderator=${moderatorEmail}, targetType=${targetType}, success=${success}`);
        
        // Set specific target fields - use explicit IDs if provided, otherwise detect from targetType
        const targetUserId = explicitUserId || (targetType?.toLowerCase() === 'user' ? targetId : null);
        const targetAnimalId = explicitAnimalId || (targetType?.toLowerCase() === 'animal' ? targetId : null);
        
        // Include error info in details if action failed
        const enhancedDetails = {
            ...details,
            ...(success === false && {
                failed: true,
                errorMessage: errorMessage || 'Unknown error',
                errorCode: errorCode || 'UNKNOWN_ERROR'
            })
        };
        
        const auditEntry = new AuditLog({
            moderatorId,
            moderatorEmail,
            action: success ? action : `${action}_failed`,
            targetType,
            targetId,
            targetUserId,
            targetAnimalId,
            targetName,
            details: enhancedDetails,
            reason,
            ipAddress,
            userAgent
        });

        console.log(`[AUDIT LOG] Audit entry created, saving to database...`);
        const savedEntry = await auditEntry.save();
        console.log(`[AUDIT LOG] ✅ Successfully saved audit log: ${action}${success ? '' : '_failed'} by ${moderatorEmail}`);
        
        return savedEntry;
    } catch (error) {
        console.error(`[AUDIT LOG] ❌ FAILED to create audit log:`, error.message);
        console.error(`[AUDIT LOG] Error stack:`, error.stack);
        // Don't throw - we don't want audit logging failures to break operations
        return null;
    }
}

/**
 * Logs a failed moderation action - convenience wrapper for createAuditLog
 * @param {Object} params - Same as createAuditLog plus error details
 * @param {Error|String} params.error - The error object or message
 * @param {String} params.attemptedAction - What was being attempted
 */
async function logFailedAction({
    moderatorId,
    moderatorEmail,
    attemptedAction,
    targetType,
    targetId = null,
    targetName = null,
    details = {},
    reason = null,
    ipAddress = null,
    userAgent = null,
    error
}) {
    // Extract error info
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorCode = error instanceof Error ? (error.code || error.name || 'ERROR') : 'UNKNOWN_ERROR';
    const errorStack = error instanceof Error ? error.stack : null;
    
    console.error(`[AUDIT LOG] ❌ Failed action: ${attemptedAction}`, {
        moderatorEmail,
        targetType,
        targetId,
        errorMessage,
        errorCode
    });
    
    return createAuditLog({
        moderatorId,
        moderatorEmail,
        action: attemptedAction,
        targetType,
        targetId,
        targetName,
        details: {
            ...details,
            errorStack: errorStack ? errorStack.split('\n').slice(0, 5).join('\n') : null
        },
        reason,
        ipAddress,
        userAgent,
        success: false,
        errorMessage,
        errorCode
    });
}

/**
 * Categorizes errors for better reporting
 * @param {Error} error - The error to categorize
 * @returns {Object} - { code, userMessage, isRetryable }
 */
function categorizeError(error) {
    const message = error?.message?.toLowerCase() || '';
    
    // Database errors
    if (message.includes('mongo') || message.includes('connection') || error?.name === 'MongoError') {
        return {
            code: 'DATABASE_ERROR',
            userMessage: 'Database temporarily unavailable. Please try again.',
            isRetryable: true
        };
    }
    
    // Validation errors
    if (message.includes('validation') || error?.name === 'ValidationError') {
        return {
            code: 'VALIDATION_ERROR',
            userMessage: 'Invalid input data. Please check your inputs.',
            isRetryable: false
        };
    }
    
    // Not found errors
    if (message.includes('not found') || message.includes('does not exist')) {
        return {
            code: 'NOT_FOUND',
            userMessage: 'The requested resource was not found.',
            isRetryable: false
        };
    }
    
    // Permission errors
    if (message.includes('permission') || message.includes('unauthorized') || message.includes('forbidden')) {
        return {
            code: 'PERMISSION_DENIED',
            userMessage: 'You do not have permission to perform this action.',
            isRetryable: false
        };
    }
    
    // Network/timeout errors
    if (message.includes('timeout') || message.includes('econnrefused') || message.includes('network')) {
        return {
            code: 'NETWORK_ERROR',
            userMessage: 'Network error. Please check your connection and try again.',
            isRetryable: true
        };
    }
    
    // Default
    return {
        code: 'INTERNAL_ERROR',
        userMessage: 'An unexpected error occurred. Please try again later.',
        isRetryable: true
    };
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
        endDate,
        failedOnly,
        search
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
    
    // Filter for failed actions only
    if (failedOnly) {
        query.action = { $regex: /_failed$/, $options: 'i' };
    }
    
    // Search in reason, targetName, action, or moderatorEmail
    if (search) {
        query.$or = [
            { reason: { $regex: search, $options: 'i' } },
            { targetName: { $regex: search, $options: 'i' } },
            { action: { $regex: search, $options: 'i' } },
            { moderatorEmail: { $regex: search, $options: 'i' } }
        ];
    }
    
    if (startDate || endDate) {
        query.createdAt = {};
        if (startDate) query.createdAt.$gte = new Date(startDate);
        if (endDate) {
            // Set end date to end of day
            const endOfDay = new Date(endDate);
            endOfDay.setHours(23, 59, 59, 999);
            query.createdAt.$lte = endOfDay;
        }
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
    getAuditLogs,
    logFailedAction,
    categorizeError
};
