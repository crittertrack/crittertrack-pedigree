const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const { User, MedicationDoseEvent } = require('../database/models');
const { markDoseGiven, skipDose, snoozeDose, userSettings } = require('../utils/doseReminders');
const {
    isValidTimeZone, ALLOWED_SNOOZE_MINUTES, ALLOWED_MISSED_AFTER_MINUTES, MAX_SNOOZES,
} = require('../utils/doseSchedule');

// Mounted at /api/medication-doses behind authMiddleware in index.js (req.user.id = the owner's _id).
// Every query is scoped to that owner.
const isId = (value) => mongoose.Types.ObjectId.isValid(value);
const badId = (res) => res.status(400).json({ message: 'Invalid dose id.' });

const toClient = (e) => ({
    id: String(e._id),
    animalId_public: e.animalId_public,
    animalName: e.animalName,
    medicationId: e.medicationId,
    medicationName: e.medicationName,
    dose: e.dose,
    scheduledAt: e.scheduledAt,
    status: e.status,
    stage: e.stage,
    snoozedUntil: e.snoozedUntil,
    snoozeCount: e.snoozeCount || 0,
    administeredAt: e.administeredAt,
    resolvedAt: e.resolvedAt,
    resolvedBy: e.resolvedBy,
});

// GET /api/medication-doses/pending doses waiting on the user (drives the in-app Given/Snooze/Skip UI)
router.get('/pending', async (req, res) => {
    try {
        const events = await MedicationDoseEvent.find({ userId: req.user.id, status: 'pending' })
            .sort({ scheduledAt: 1 }).limit(100).lean();
        res.json({ doses: events.map(toClient), maxSnoozes: MAX_SNOOZES });
    } catch (err) {
        console.error('[medication-doses] pending failed:', err);
        res.status(500).json({ message: 'Failed to load pending doses.' });
    }
});

// GET /api/medication-doses/history?animalId_public=CTxxx&medicationId=...&limit=50 dose history
router.get('/history', async (req, res) => {
    try {
        const { animalId_public, medicationId } = req.query;
        if (!animalId_public) return res.status(400).json({ message: 'animalId_public is required.' });
        const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 200);
        const query = { userId: req.user.id, animalId_public: String(animalId_public) };
        if (medicationId) query.medicationId = String(medicationId);
        const events = await MedicationDoseEvent.find(query).sort({ scheduledAt: -1 }).limit(limit).lean();
        res.json({ doses: events.map(toClient) });
    } catch (err) {
        console.error('[medication-doses] history failed:', err);
        res.status(500).json({ message: 'Failed to load dose history.' });
    }
});

// POST /api/medication-doses/:id/given
router.post('/:id/given', async (req, res) => {
    try {
        if (!isId(req.params.id)) return badId(res);
        const event = await markDoseGiven(req.user.id, req.params.id);
        if (!event) return res.status(404).json({ message: 'That dose is no longer pending.' });
        res.json({ dose: toClient(event) });
    } catch (err) {
        console.error('[medication-doses] given failed:', err);
        res.status(500).json({ message: 'Failed to mark dose as given.' });
    }
});

// POST /api/medication-doses/:id/skip
router.post('/:id/skip', async (req, res) => {
    try {
        if (!isId(req.params.id)) return badId(res);
        const event = await skipDose(req.user.id, req.params.id);
        if (!event) return res.status(404).json({ message: 'That dose is no longer pending.' });
        res.json({ dose: toClient(event) });
    } catch (err) {
        console.error('[medication-doses] skip failed:', err);
        res.status(500).json({ message: 'Failed to skip dose.' });
    }
});

// POST /api/medication-doses/:id/snooze { minutes? } minutes must be one of the allowed options
router.post('/:id/snooze', async (req, res) => {
    try {
        if (!isId(req.params.id)) return badId(res);
        const result = await snoozeDose(req.user.id, req.params.id, req.body?.minutes);
        if (result.error === 'limit') {
            return res.status(409).json({ message: `This dose has already been snoozed ${MAX_SNOOZES} times.`, code: 'snooze_limit' });
        }
        if (result.error) return res.status(404).json({ message: 'That dose is no longer pending.' });
        res.json({ dose: toClient(result.event) });
    } catch (err) {
        console.error('[medication-doses] snooze failed:', err);
        res.status(500).json({ message: 'Failed to snooze dose.' });
    }
});

const settingsPayload = (user) => {
    const s = userSettings(user);
    return {
        timeZone: user?.timeZone || null,
        snoozeMinutes: s.snoozeMinutes,
        missedAfterMinutes: s.missedAfterMinutes,
        emailEscalation: s.emailEscalation,
        options: { snoozeMinutes: ALLOWED_SNOOZE_MINUTES, missedAfterMinutes: ALLOWED_MISSED_AFTER_MINUTES, maxSnoozes: MAX_SNOOZES },
    };
};

// GET /api/medication-doses/settings
router.get('/settings', async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('timeZone medicationReminderPrefs').lean();
        res.json(settingsPayload(user));
    } catch (err) {
        console.error('[medication-doses] settings load failed:', err);
        res.status(500).json({ message: 'Failed to load reminder settings.' });
    }
});

// PUT /api/medication-doses/settings { timeZone?, snoozeMinutes?, missedAfterMinutes?, emailEscalation? }
router.put('/settings', async (req, res) => {
    try {
        const { timeZone, snoozeMinutes, missedAfterMinutes, emailEscalation } = req.body || {};
        const set = {};
        if (timeZone !== undefined) {
            if (!isValidTimeZone(timeZone)) return res.status(400).json({ message: 'Invalid time zone.' });
            set.timeZone = timeZone;
        }
        if (snoozeMinutes !== undefined) {
            if (!ALLOWED_SNOOZE_MINUTES.includes(Number(snoozeMinutes))) return res.status(400).json({ message: 'Invalid snooze length.' });
            set['medicationReminderPrefs.snoozeMinutes'] = Number(snoozeMinutes);
        }
        if (missedAfterMinutes !== undefined) {
            if (!ALLOWED_MISSED_AFTER_MINUTES.includes(Number(missedAfterMinutes))) return res.status(400).json({ message: 'Invalid missed-after window.' });
            set['medicationReminderPrefs.missedAfterMinutes'] = Number(missedAfterMinutes);
        }
        if (emailEscalation !== undefined) set['medicationReminderPrefs.emailEscalation'] = emailEscalation === true;
        if (!Object.keys(set).length) return res.status(400).json({ message: 'No valid settings provided.' });
        const user = await User.findByIdAndUpdate(req.user.id, { $set: set }, { new: true })
            .select('timeZone medicationReminderPrefs').lean();
        res.json(settingsPayload(user));
    } catch (err) {
        console.error('[medication-doses] settings save failed:', err);
        res.status(500).json({ message: 'Failed to save reminder settings.' });
    }
});

module.exports = router;
