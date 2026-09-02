const express = require('express');
const router = express.Router();
const { User, Animal, Litter, Enclosure, SupplyItem, PublicProfile } = require('../database/models');
const { PUSH_CATEGORIES } = require('../utils/pushService');
const {
    daysSince, isTaskDue, isFeedingDue, cleaningTaskFreqDays, calcNextDose,
    SCHEDULE_FIELD_KEYS, HEALTH_STATUSES_OF_CONCERN,
} = require('../utils/animalAlertsCron');

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

// POST /api/push/register-device — save (or refresh) a native app's FCM device token
router.post('/register-device', async (req, res) => {
    try {
        const { token, platform } = req.body;
        if (!token) {
            return res.status(400).json({ message: 'A device token is required.' });
        }
        await User.updateOne({ _id: req.user.id }, { $pull: { deviceTokens: { token } } });
        await User.updateOne(
            { _id: req.user.id },
            { $push: { deviceTokens: { token, platform: platform === 'ios' ? 'ios' : 'android' } } }
        );
        res.status(200).json({ message: 'Device registered for push notifications.' });
    } catch (error) {
        console.error('Error registering device token:', error);
        res.status(500).json({ message: 'Failed to register device.' });
    }
});

// POST /api/push/unregister-device — remove a single device's FCM token (e.g. on logout)
router.post('/unregister-device', async (req, res) => {
    try {
        const { token } = req.body;
        if (!token) {
            return res.status(400).json({ message: 'token is required.' });
        }
        await User.updateOne({ _id: req.user.id }, { $pull: { deviceTokens: { token } } });
        res.status(200).json({ message: 'Device unregistered.' });
    } catch (error) {
        console.error('Error unregistering device token:', error);
        res.status(500).json({ message: 'Failed to unregister device.' });
    }
});

// GET /api/push/alert-count — on-demand due-item counts for the bell icon badge, scoped to the
// current user only. Mirrors animalAlertsCron.js's per-category logic exactly (same helpers,
// same creatorId-only convention) so this always agrees with what would actually trigger a push.
router.get('/alert-count', async (req, res) => {
    try {
        const userId = req.user.id;
        const counts = { feeding: 0, careTasks: 0, enclosureCare: 0, health: 0, breeding: 0 };

        const animals = await Animal.find({ creatorId: userId, archived: { $ne: true } })
            .select('lastFedDate feedingIntervalHours animalCareTasks quarantineDetails healthStatus healthStatusOverride medications ' + SCHEDULE_FIELD_KEYS.join(' '))
            .lean();
        animals.forEach((a) => {
            if (isFeedingDue(a.lastFedDate, a.feedingIntervalHours)) counts.feeding += 1;
            counts.careTasks += (a.animalCareTasks || []).filter((t) => isTaskDue(t.lastDoneDate, t.frequencyDays)).length;
            counts.careTasks += SCHEDULE_FIELD_KEYS.filter((key) => isTaskDue(a[key]?.lastDoneDate, a[key]?.frequencyDays)).length;
            const quarantineActive = a.quarantineDetails?.status && a.quarantineDetails.status !== 'None';
            if (quarantineActive && a.quarantineDetails?.endDate && daysSince(a.quarantineDetails.endDate) >= 0) counts.health += 1;
            const status = a.healthStatusOverride || a.healthStatus;
            if (HEALTH_STATUSES_OF_CONCERN.includes(status)) counts.health += 1;
            counts.health += (a.medications || [])
                .filter((m) => !m.status || m.status === 'active')
                .map((m) => calcNextDose(m))
                .filter((next) => next && next.getTime() <= Date.now()).length;
        });

        const enclosures = await Enclosure.find({ creatorId: userId }).select('cleaningTasks').lean();
        enclosures.forEach((e) => {
            counts.enclosureCare += (e.cleaningTasks || []).filter((t) => isTaskDue(t.lastDoneDate, cleaningTaskFreqDays(t))).length;
        });

        const profile = await PublicProfile.findOne({ userId_backend: userId }).select('generalCareTasks').lean();
        (profile?.generalCareTasks || []).forEach((t) => {
            if (!isTaskDue(t.lastDoneDate, cleaningTaskFreqDays(t))) return;
            const category = t.type === 'Feeding' ? 'feeding' : t.type === 'Cleaning' || t.type === 'Maintenance' ? 'enclosureCare' : 'careTasks';
            counts[category] += 1;
        });

        const litters = await Litter.find({ creatorId: userId })
            .select('isPlanned matingDate pregnancyDate expectedDueDate birthDate weaningDate weaningConfirmed pregnancyLost')
            .lean();
        litters.forEach((l) => {
            if (l.isPlanned && !l.pregnancyDate && !l.birthDate && l.matingDate && daysSince(l.matingDate) >= 0) counts.breeding += 1;
            if (l.pregnancyDate && !l.birthDate && l.expectedDueDate && daysSince(l.expectedDueDate) >= 0) counts.breeding += 1;
            const stillNursing = !l.weaningConfirmed && !l.pregnancyLost;
            if (l.birthDate && l.weaningDate && stillNursing && daysSince(l.weaningDate) >= 0) counts.breeding += 1;
        });

        const supplies = await SupplyItem.find({ userId }).select('currentStock reorderThreshold nextOrderDate').lean();
        const today = new Date(); today.setHours(0, 0, 0, 0);
        supplies.forEach((s) => {
            const due = (s.reorderThreshold != null && s.currentStock <= s.reorderThreshold) ||
                (s.nextOrderDate && new Date(s.nextOrderDate) <= today);
            if (due) counts.enclosureCare += 1;
        });

        const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
        res.status(200).json({ ...counts, total });
    } catch (error) {
        console.error('Error computing alert count:', error);
        res.status(500).json({ message: 'Failed to compute alert count.' });
    }
});

module.exports = router;
