const express = require('express');
const router = express.Router();
const { getUserActivityLogs } = require('../utils/userActivityLogger');

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
