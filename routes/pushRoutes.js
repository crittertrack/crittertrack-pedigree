const express = require('express');
const router = express.Router();
const { User } = require('../database/models');
const { PUSH_CATEGORIES } = require('../utils/pushService');

// Note: GET /vapid-public-key is registered directly in index.js (unauthenticated), not here.

// POST /api/push/subscribe — save (or refresh) a browser's push subscription
router.post('/subscribe', async (req, res) => {
    try {
        const { subscription } = req.body;
        if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
            return res.status(400).json({ message: 'A valid push subscription is required.' });
        }

        await User.updateOne(
            { _id: req.user.id },
            { $pull: { pushSubscriptions: { endpoint: subscription.endpoint } } }
        );
        await User.updateOne(
            { _id: req.user.id },
            { $push: { pushSubscriptions: {
                endpoint: subscription.endpoint,
                keys: { p256dh: subscription.keys.p256dh, auth: subscription.keys.auth },
                userAgent: req.headers['user-agent'] || null
            } } }
        );

        res.status(200).json({ message: 'Subscribed to push notifications.' });
    } catch (error) {
        console.error('Error saving push subscription:', error);
        res.status(500).json({ message: 'Failed to save push subscription.' });
    }
});

// POST /api/push/unsubscribe — remove a single browser's subscription (e.g. user disabled it)
router.post('/unsubscribe', async (req, res) => {
    try {
        const { endpoint } = req.body;
        if (!endpoint) {
            return res.status(400).json({ message: 'endpoint is required.' });
        }
        await User.updateOne(
            { _id: req.user.id },
            { $pull: { pushSubscriptions: { endpoint } } }
        );
        res.status(200).json({ message: 'Unsubscribed from push notifications.' });
    } catch (error) {
        console.error('Error removing push subscription:', error);
        res.status(500).json({ message: 'Failed to remove push subscription.' });
    }
});

// GET /api/push/preferences — current per-category on/off state plus whether this browser is subscribed
router.get('/preferences', async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('pushSubscriptions pushCategoryPreferences');
        const prefs = {};
        PUSH_CATEGORIES.forEach(({ id }) => {
            const stored = user.pushCategoryPreferences?.get ? user.pushCategoryPreferences.get(id) : undefined;
            prefs[id] = stored !== false;
        });
        res.status(200).json({
            categories: PUSH_CATEGORIES,
            preferences: prefs,
            hasAnySubscription: (user.pushSubscriptions || []).length > 0
        });
    } catch (error) {
        console.error('Error fetching push preferences:', error);
        res.status(500).json({ message: 'Failed to fetch push preferences.' });
    }
});

// PUT /api/push/preferences — update one or more category toggles, e.g. { messages: false }
router.put('/preferences', async (req, res) => {
    try {
        const updates = req.body || {};
        const validIds = new Set(PUSH_CATEGORIES.map(c => c.id));
        const setOps = {};
        Object.entries(updates).forEach(([key, value]) => {
            if (validIds.has(key)) {
                setOps[`pushCategoryPreferences.${key}`] = !!value;
            }
        });
        if (Object.keys(setOps).length === 0) {
            return res.status(400).json({ message: 'No valid category preferences provided.' });
        }
        await User.updateOne({ _id: req.user.id }, { $set: setOps });
        res.status(200).json({ message: 'Push preferences updated.' });
    } catch (error) {
        console.error('Error updating push preferences:', error);
        res.status(500).json({ message: 'Failed to update push preferences.' });
    }
});

module.exports = router;
