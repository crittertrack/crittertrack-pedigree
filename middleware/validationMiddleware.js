const validator = require('validator');

/**
 * Validation middleware for moderation endpoints
 * Sanitizes and validates user input to prevent injection attacks
 */

const validateModerationInput = (req, res, next) => {
    try {
        // Validate body fields
        if (req.body) {
            // String fields: reason, message, title, etc
            if (req.body.reason && typeof req.body.reason === 'string') {
                req.body.reason = validator.trim(req.body.reason).slice(0, 1000); // Max 1000 chars
                if (req.body.reason && !validator.isLength(req.body.reason, { min: 1, max: 1000 })) {
                    return res.status(400).json({ error: 'Reason must be between 1 and 1000 characters' });
                }
            }

            if (req.body.message && typeof req.body.message === 'string') {
                req.body.message = validator.trim(req.body.message).slice(0, 2000);
                if (req.body.message && !validator.isLength(req.body.message, { min: 1, max: 2000 })) {
                    return res.status(400).json({ error: 'Message must be between 1 and 2000 characters' });
                }
            }

            if (req.body.title && typeof req.body.title === 'string') {
                req.body.title = validator.trim(req.body.title).slice(0, 500);
                if (req.body.title && !validator.isLength(req.body.title, { min: 1, max: 500 })) {
                    return res.status(400).json({ error: 'Title must be between 1 and 500 characters' });
                }
            }

            // Status field: only allow specific values
            if (req.body.status) {
                const validStatuses = ['normal', 'suspended', 'banned'];
                if (!validStatuses.includes(req.body.status)) {
                    return res.status(400).json({ error: 'Invalid status value' });
                }
            }

            // Duration days: must be positive integer
            if (req.body.durationDays) {
                const duration = parseInt(req.body.durationDays);
                if (isNaN(duration) || duration < 0 || duration > 3650) { // Max 10 years
                    return res.status(400).json({ error: 'Duration must be a positive number (0-3650 days)' });
                }
                req.body.durationDays = duration;
            }

            // Boolean fields
            if (typeof req.body.ipBan !== 'undefined') {
                req.body.ipBan = Boolean(req.body.ipBan);
            }

            // Report action: only allow specific values
            if (req.body.action) {
                const validActions = ['resolved', 'dismissed', 'review'];
                if (!validActions.includes(req.body.action)) {
                    return res.status(400).json({ error: 'Invalid action value' });
                }
            }

            // Category field: sanitize but allow
            if (req.body.category && typeof req.body.category === 'string') {
                req.body.category = validator.trim(req.body.category).slice(0, 100);
            }
        }

        // Validate query parameters
        if (req.query) {
            if (req.query.search && typeof req.query.search === 'string') {
                // Prevent regex special characters in search
                req.query.search = validator.escape(req.query.search).slice(0, 100);
            }

            // Pagination: limit must be between 1-1000
            if (req.query.limit) {
                const limit = parseInt(req.query.limit);
                if (isNaN(limit) || limit < 1 || limit > 1000) {
                    return res.status(400).json({ error: 'Limit must be between 1 and 1000' });
                }
                req.query.limit = limit;
            }

            // Skip must be non-negative
            if (req.query.skip) {
                const skip = parseInt(req.query.skip);
                if (isNaN(skip) || skip < 0) {
                    return res.status(400).json({ error: 'Skip must be non-negative' });
                }
                req.query.skip = skip;
            }
        }

        next();
    } catch (error) {
        console.error('[VALIDATION] Error in moderation input validation:', error);
        res.status(400).json({ error: 'Invalid request input' });
    }
};

module.exports = { validateModerationInput };
