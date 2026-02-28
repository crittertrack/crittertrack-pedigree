const { UserActivityLog } = require('../database/models');

/**
 * Creates a user activity log entry
 * @param {Object} params - Activity log parameters
 * @param {String} params.userId - MongoDB ID of the user
 * @param {String} params.id_public - Public ID of the user (e.g., CTU123)
 * @param {String} params.action - Action type (e.g., 'login', 'animal_create')
 * @param {String} params.targetType - Type of target (e.g., 'animal', 'profile', 'litter')
 * @param {String} params.targetId - MongoDB ID of the target
 * @param {String} params.targetId_public - Public ID of the target
 * @param {Object} params.details - Additional details about the action
 * @param {Object} params.previousValue - Previous value (for edit actions)
 * @param {Object} params.newValue - New value (for edit actions)
 * @param {String} params.ipAddress - IP address of the user
 * @param {String} params.userAgent - User agent string
 * @param {Boolean} params.success - Whether the action succeeded (default: true)
 */
async function logUserActivity({
    userId,
    id_public = null,
    action,
    targetType = null,
    targetId = null,
    targetId_public = null,
    details = {},
    previousValue = null,
    newValue = null,
    ipAddress = null,
    userAgent = null,
    success = true
}) {
    try {
        const activityEntry = new UserActivityLog({
            userId,
            id_public,
            action,
            targetType,
            targetId,
            targetId_public,
            details,
            previousValue,
            newValue,
            ipAddress,
            userAgent,
            success
        });

        await activityEntry.save();
        return activityEntry;
    } catch (error) {
        console.error(`[USER ACTIVITY] Failed to log activity:`, error.message);
        // Don't throw - we don't want logging failures to break operations
        return null;
    }
}

/**
 * Get user activity logs with filtering and pagination
 * @param {Object} filters - Filter criteria
 * @param {Object} options - Pagination and sorting options
 */
async function getUserActivityLogs(filters = {}, options = {}) {
    const {
        userId,
        id_public,
        action,
        targetType,
        startDate,
        endDate,
        search
    } = filters;

    const {
        page = 1,
        limit = 50,
        sortBy = 'createdAt',
        sortOrder = 'desc'
    } = options;

    const query = {};

    if (userId) query.userId = userId;
    if (id_public) query.id_public = id_public;
    if (action) query.action = action;
    if (targetType) query.targetType = targetType;

    if (startDate || endDate) {
        query.createdAt = {};
        if (startDate) query.createdAt.$gte = new Date(startDate);
        if (endDate) {
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            query.createdAt.$lte = end;
        }
    }

    if (search) {
        query.$or = [
            { action: { $regex: search, $options: 'i' } },
            { id_public: { $regex: search, $options: 'i' } },
            { targetId_public: { $regex: search, $options: 'i' } }
        ];
    }

    const skip = (page - 1) * limit;
    const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

    const [logs, total] = await Promise.all([
        UserActivityLog.find(query)
            .sort(sort)
            .skip(skip)
            .limit(limit)
            .lean(),
        UserActivityLog.countDocuments(query)
    ]);

    return {
        logs,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
    };
}

/**
 * Get activity summary for a specific user
 * @param {String} userId - MongoDB ID of the user
 */
async function getUserActivitySummary(userId) {
    const now = new Date();
    const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);

    const [recentActivity, actionCounts, lastLogin] = await Promise.all([
        UserActivityLog.find({ userId, createdAt: { $gte: thirtyDaysAgo } })
            .sort({ createdAt: -1 })
            .limit(10)
            .lean(),
        UserActivityLog.aggregate([
            { $match: { userId: userId } },
            { $group: { _id: '$action', count: { $sum: 1 } } }
        ]),
        UserActivityLog.findOne({ userId, action: 'login' })
            .sort({ createdAt: -1 })
            .lean()
    ]);

    return {
        recentActivity,
        actionCounts: actionCounts.reduce((acc, curr) => {
            acc[curr._id] = curr.count;
            return acc;
        }, {}),
        lastLogin: lastLogin?.createdAt || null,
        totalActions: actionCounts.reduce((sum, curr) => sum + curr.count, 0)
    };
}

// Action type constants for consistency
const USER_ACTIONS = {
    // Auth
    LOGIN: 'login',
    LOGOUT: 'logout',
    PASSWORD_CHANGE: 'password_change',
    EMAIL_CHANGE: 'email_change',
    
    // Profile
    PROFILE_UPDATE: 'profile_update',
    PROFILE_IMAGE_CHANGE: 'profile_image_change',
    PRIVACY_SETTINGS_CHANGE: 'privacy_settings_change',
    
    // Animals
    ANIMAL_CREATE: 'animal_create',
    ANIMAL_UPDATE: 'animal_update',
    ANIMAL_DELETE: 'animal_delete',
    ANIMAL_IMAGE_UPLOAD: 'animal_image_upload',
    ANIMAL_IMAGE_DELETE: 'animal_image_delete',
    ANIMAL_VISIBILITY_CHANGE: 'animal_visibility_change',
    ANIMAL_TRANSFER_INITIATE: 'animal_transfer_initiate',
    ANIMAL_TRANSFER_ACCEPT: 'animal_transfer_accept',
    ANIMAL_TRANSFER_REJECT: 'animal_transfer_reject',
    
    // Litters
    LITTER_CREATE: 'litter_create',
    LITTER_UPDATE: 'litter_update',
    LITTER_DELETE: 'litter_delete',
    
    // Messages
    MESSAGE_SEND: 'message_send',
    MESSAGE_DELETE: 'message_delete',
    
    // Reports
    REPORT_SUBMIT: 'report_submit',
    
    // Budget
    TRANSACTION_CREATE: 'transaction_create',
    TRANSACTION_DELETE: 'transaction_delete',

    // Management panel
    ENCLOSURE_CREATE: 'enclosure_create',
    ENCLOSURE_UPDATE: 'enclosure_update',
    ENCLOSURE_DELETE: 'enclosure_delete',
    ENCLOSURE_ASSIGN: 'enclosure_assign',
    ENCLOSURE_UNASSIGN: 'enclosure_unassign',
    ANIMAL_FED: 'animal_fed',
    CARE_TASK_DONE: 'care_task_done',
    ENCLOSURE_TASK_DONE: 'enclosure_task_done',
    REPRODUCTION_UPDATE: 'reproduction_update',
};

module.exports = {
    logUserActivity,
    getUserActivityLogs,
    getUserActivitySummary,
    USER_ACTIONS
};
