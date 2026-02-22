const express = require('express');
const router = express.Router();
const { logUserActivity, getUserActivityLogs } = require('../utils/userActivityLogger');

// Whitelist of action types that can be logged via the client-side POST endpoint.
// Only management-panel actions are allowed here.
const MANAGEMENT_ACTIONS = new Set([
    'enclosure_create', 'enclosure_update', 'enclosure_delete',
    'enclosure_assign', 'enclosure_unassign',
    'animal_fed', 'care_task_done', 'enclosure_task_done',
    'reproduction_update',
]);

// POST /api/activity-logs — log a management panel action from the client
router.post('/', async (req, res) => {
    try {
        const { action, targetId_public, details } = req.body;
        if (!action || !MANAGEMENT_ACTIONS.has(action)) {
            return res.status(400).json({ message: 'Invalid or unsupported action type.' });
        }
        await logUserActivity({
            userId: req.user.id,
            action,
            targetType: 'management',
            targetId_public: targetId_public || null,
            details: details || {},
            success: true,
        });
        res.status(201).json({ ok: true });
    } catch (err) {
        console.error('[activity-logs POST]', err);
        res.status(500).json({ message: 'Failed to log activity.' });
    }
});

// GET /api/activity-logs
// Returns the authenticated user's own activity log, paginated and filterable.
// Query params: action, targetType, startDate, endDate, search, page (default 1), limit (default 30, max 100)
router.get('/', async (req, res) => {
    try {
        const {
            action,
            targetType,
            startDate,
            endDate,
            search,
            page = 1,
            limit = 30
        } = req.query;

        const parsedPage = Math.max(1, parseInt(page, 10) || 1);
        const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 30));

        const result = await getUserActivityLogs(
            {
                userId: req.user.id,
                ...(action && { action }),
                ...(targetType && { targetType }),
                ...(startDate && { startDate }),
                ...(endDate && { endDate }),
                ...(search && { search })
            },
            { page: parsedPage, limit: parsedLimit }
        );

        res.json(result);
    } catch (err) {
        console.error('[activity-logs] Error fetching activity logs:', err);
        res.status(500).json({ message: 'Failed to fetch activity logs.' });
    }
});

module.exports = router;
