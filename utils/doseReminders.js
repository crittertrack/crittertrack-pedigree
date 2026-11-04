// Medication dose reminders with snooze + escalation, and the dose history.
//
// A node-cron job runs every 5 minutes. For every active medication with a schedule it finds the
// latest scheduled dose (utils/doseSchedule.js), creates a MedicationDoseEvent for it, then walks
// pending events through the escalation ladder:
//   stage 1  reminder      push at the dose time
//   stage 2  nudge         push, 25% of the "missed after" window later
//   stage 3  final alert   push (+ email ONLY if the owner opted in), 75% of the window
//   deadline               dose recorded as "missed"
// Push goes through sendPushToUser with the existing 'health' category, so a user who switched that
// category off gets nothing. Email is opt-in (medicationReminderPrefs.emailEscalation, default off)
// and is additionally suppressed when the 'health' category is off.
const cron = require('node-cron');
const { Animal, User, MedicationDoseEvent } = require('../database/models');
const { sendPushToUser, isCategoryEnabled } = require('./pushService');
const { formatAnimalName } = require('./alertNames');
const {
    DEFAULT_SNOOZE_MINUTES, DEFAULT_MISSED_AFTER_MINUTES, MAX_SNOOZES,
    ALLOWED_SNOOZE_MINUTES, ALLOWED_MISSED_AFTER_MINUTES,
    resolveTimeZone, medIntervalMs, isMedActive, latestDueSlot, coveringAdministrationDate,
    evaluateEvent, snoozeUpdate, buildReminderMessage,
} = require('./doseSchedule');

const MINUTE_MS = 60000;
const HEALTH_URL = '/animals?view=health';

const userSettings = (user) => {
    const prefs = user?.medicationReminderPrefs || {};
    return {
        timeZone: resolveTimeZone(user?.timeZone),
        snoozeMinutes: ALLOWED_SNOOZE_MINUTES.includes(prefs.snoozeMinutes) ? prefs.snoozeMinutes : DEFAULT_SNOOZE_MINUTES,
        missedAfterMinutes: ALLOWED_MISSED_AFTER_MINUTES.includes(prefs.missedAfterMinutes) ? prefs.missedAfterMinutes : DEFAULT_MISSED_AFTER_MINUTES,
        emailEscalation: prefs.emailEscalation === true,
    };
};

// A medication gets reminders when it has a usable schedule, is active and reminders aren't switched off.
const medicationWantsReminders = (med) => !!med && !!med.id && isMedActive(med)
    && med.remindersEnabled !== false && !!medIntervalMs(med) && !!med.startDate;

const findMedication = (animal, medicationId) => (animal?.medications || []).find((m) => m.id === medicationId);

const sendEscalationEmail = async (user, settings, info) => {
    // Opt-in only, and never when the user has switched the health notification category off.
    if (!settings.emailEscalation || !user?.email || !user.emailVerified) return;
    if (!isCategoryEnabled(user, 'health')) return;
    try {
        const { sendEmail } = require('./emailService');
        const { title, body } = buildReminderMessage(3, info);
        await sendEmail(user.email, `CritterTrack: ${title}`, `<p>${body}</p><p>Open CritterTrack to mark the dose as given, snooze it or skip it.</p>`);
    } catch (err) {
        console.error('[doseReminders] Escalation email failed:', err.message || err);
    }
};

const notifyStage = async (event, stage, user, settings) => {
    const info = { animalName: event.animalName, medName: event.medicationName, dose: event.dose };
    const { title, body } = buildReminderMessage(stage, info);
    await sendPushToUser(user || event.userId, {
        title, body, url: `${HEALTH_URL}&dose=${event._id}`, tag: `dose-${event._id}`, eventId: String(event._id),
    }, 'health').catch((err) => console.error('[doseReminders] Push failed:', err.message || err));
    if (stage >= 3) await sendEscalationEmail(user, settings, info);
};

// Creates the event for the latest due dose if there isn't one yet. Returns true when created.
const ensureEventForSlot = async ({ animal, med, slotMs, nowMs, settings }) => {
    const intervalMs = medIntervalMs(med);
    const windowMs = Math.min(settings.missedAfterMinutes * MINUTE_MS, intervalMs);
    // Only dose slots still inside their window: never fabricate a "missed" dose for the past
    // (e.g. a medication entered with an old start date) and never backfill old history.
    if (nowMs - slotMs >= windowMs) return false;
    const covered = coveringAdministrationDate(med, slotMs);
    const scheduledAt = new Date(slotMs);
    const doc = {
        userId: animal.creatorId, animalId: animal._id, animalId_public: animal.id_public,
        animalName: formatAnimalName(animal), medicationId: med.id, medicationName: med.name || null,
        dose: med.dose || null, scheduledAt, clockStart: scheduledAt,
        status: covered ? 'given' : 'pending', stage: covered ? 3 : 0,
        administeredAt: covered || null, resolvedAt: covered ? new Date(nowMs) : null, resolvedBy: covered ? 'user' : null,
    };
    try {
        const res = await MedicationDoseEvent.updateOne(
            { animalId: animal._id, medicationId: med.id, scheduledAt },
            { $setOnInsert: doc },
            { upsert: true }
        );
        return res.upsertedCount > 0;
    } catch (err) {
        if (err.code === 11000) return false; // another instance/tick created it first
        throw err;
    }
};

const USER_FIELDS = 'timeZone medicationReminderPrefs email emailVerified pushSubscriptions deviceTokens pushCategoryPreferences';

// One scheduler pass: create events for newly due doses, then advance every pending event.
const runDoseReminderCheck = async (nowMs = Date.now()) => {
    const animals = await Animal.find({ archived: { $ne: true }, 'medications.0': { $exists: true } })
        .select('creatorId id_public prefix name suffix medications').lean();
    const animalsById = new Map(animals.map((a) => [String(a._id), a]));
    const creatorIds = [...new Set(animals.map((a) => a.creatorId && String(a.creatorId)).filter(Boolean))];
    const users = await User.find({ _id: { $in: creatorIds } }).select(USER_FIELDS).lean();
    const usersById = new Map(users.map((u) => [String(u._id), u]));

    // 1. Create an event for the latest due dose of each scheduled medication.
    let created = 0;
    for (const animal of animals) {
        const user = usersById.get(String(animal.creatorId));
        if (!user) continue;
        const settings = userSettings(user);
        for (const med of animal.medications || []) {
            if (!medicationWantsReminders(med)) continue;
            const slotMs = latestDueSlot(med, nowMs, settings.timeZone);
            if (slotMs === null) continue;
            try {
                if (await ensureEventForSlot({ animal, med, slotMs, nowMs, settings })) created++;
            } catch (err) {
                console.error(`[doseReminders] Could not create dose event for ${animal.id_public}/${med.id}:`, err.message || err);
            }
        }
    }

    // 2. Advance pending events (skipping ones still snoozed).
    const pending = await MedicationDoseEvent.find({
        status: 'pending',
        $or: [{ snoozedUntil: null }, { snoozedUntil: { $lte: new Date(nowMs) } }],
    }).lean();
    let notified = 0; let missed = 0;
    for (const event of pending) {
        try {
            const animal = animalsById.get(String(event.animalId));
            const med = animal ? findMedication(animal, event.medicationId) : null;
            if (!medicationWantsReminders(med)) {
                // The medication was removed, finished or had reminders switched off: nothing to record.
                await MedicationDoseEvent.deleteOne({ _id: event._id, status: 'pending' });
                continue;
            }
            const covered = coveringAdministrationDate(med, new Date(event.scheduledAt).getTime());
            if (covered) {
                await MedicationDoseEvent.updateOne({ _id: event._id, status: 'pending' },
                    { $set: { status: 'given', administeredAt: covered, resolvedAt: new Date(nowMs), resolvedBy: 'user' } });
                continue;
            }
            const user = usersById.get(String(event.userId));
            const settings = userSettings(user);
            const decision = evaluateEvent({ event, nowMs, missedAfterMinutes: settings.missedAfterMinutes, intervalMs: medIntervalMs(med) });
            if (decision.action === 'missed') {
                const res = await MedicationDoseEvent.updateOne({ _id: event._id, status: 'pending' },
                    { $set: { status: 'missed', resolvedAt: new Date(nowMs), resolvedBy: 'system' } });
                if (res.modifiedCount) missed++;
            } else if (decision.action === 'notify') {
                // Claim the stage atomically so overlapping ticks / instances never double-send.
                const claim = await MedicationDoseEvent.updateOne(
                    { _id: event._id, status: 'pending', stage: { $lt: decision.stage } },
                    { $set: { stage: decision.stage } });
                if (claim.modifiedCount) {
                    await notifyStage(event, decision.stage, user, settings);
                    notified++;
                }
            }
        } catch (err) {
            console.error(`[doseReminders] Failed processing dose event ${event._id}:`, err.message || err);
        }
    }
    return { created, notified, missed, pending: pending.length };
};

// ---- User actions on a dose event (all scoped to the owning user) ----

const loadSettingsForUser = async (userId) => userSettings(await User.findById(userId).select('timeZone medicationReminderPrefs').lean());

// Mark a pending (or already-missed, logged late) dose as given. Also records the administration on
// the medication itself so the existing next-dose logic and timeline stay consistent.
// A dose logged late (it was already recorded as missed) fixes the history but adds no
// administration, so a late entry can't be mistaken for the NEXT dose.
const markDoseGiven = async (userId, eventId, nowMs = Date.now()) => {
    const when = new Date(nowMs);
    const previous = await MedicationDoseEvent.findOneAndUpdate(
        { _id: eventId, userId, status: { $in: ['pending', 'missed'] } },
        { $set: { status: 'given', administeredAt: when, resolvedAt: when, resolvedBy: 'user', snoozedUntil: null } },
        { new: false });
    if (!previous) return null;
    if (previous.status === 'pending') {
        await Animal.updateOne(
            { _id: previous.animalId, creatorId: userId },
            { $push: { 'medications.$[m].administrations': { date: when } } },
            { arrayFilters: [{ 'm.id': previous.medicationId }] });
    }
    return { ...previous.toObject(), status: 'given', administeredAt: when, resolvedAt: when, resolvedBy: 'user', snoozedUntil: null };
};

const skipDose = async (userId, eventId, nowMs = Date.now()) => MedicationDoseEvent.findOneAndUpdate(
    { _id: eventId, userId, status: 'pending' },
    { $set: { status: 'skipped', resolvedAt: new Date(nowMs), resolvedBy: 'user', snoozedUntil: null } },
    { new: true });

// Snooze a pending dose. Returns { event } or { error: 'not_found' | 'limit' }.
const snoozeDose = async (userId, eventId, minutes, nowMs = Date.now()) => {
    const settings = await loadSettingsForUser(userId);
    const requested = Number(minutes);
    const snoozeMinutes = ALLOWED_SNOOZE_MINUTES.includes(requested) ? requested : settings.snoozeMinutes;
    const current = await MedicationDoseEvent.findOne({ _id: eventId, userId, status: 'pending' }).lean();
    if (!current) return { error: 'not_found' };
    if ((current.snoozeCount || 0) >= MAX_SNOOZES) return { error: 'limit' };
    const update = snoozeUpdate(current, nowMs, snoozeMinutes);
    const event = await MedicationDoseEvent.findOneAndUpdate(
        { _id: eventId, userId, status: 'pending', snoozeCount: current.snoozeCount || 0 },
        { $set: update }, { new: true });
    return event ? { event } : { error: 'not_found' };
};

let running = false;
const startDoseReminderCron = () => {
    cron.schedule('*/5 * * * *', async () => {
        if (running) return; // never overlap a slow pass with the next tick
        running = true;
        try {
            const result = await runDoseReminderCheck();
            if (result.created || result.notified || result.missed) {
                console.log(`[doseReminders] created=${result.created} notified=${result.notified} missed=${result.missed}`);
            }
        } catch (err) {
            console.error('[doseReminders] Run failed:', err.message || err);
        } finally {
            running = false;
        }
    });
    console.log('[doseReminders] Scheduled (every 5 minutes).');
};

module.exports = {
    startDoseReminderCron, runDoseReminderCheck, markDoseGiven, skipDose, snoozeDose,
    userSettings, medicationWantsReminders,
};
