// Pure scheduling + escalation helpers for medication dose reminders (no DB access, so they
// are unit-testable). The DB-facing scheduler lives in utils/doseReminders.js.
//
// A medication (Animal.medications[]) has startDate + intervalValue/intervalUnit, plus an optional
// doseTime ("HH:MM", the wall-clock time of the first dose, in the owner's time zone). Doses fall on
// a FIXED schedule from that anchor (start + k * interval), independent of when they were given.

const DEFAULT_DOSE_TIME = '08:00';
const DEFAULT_SNOOZE_MINUTES = 30;
const DEFAULT_MISSED_AFTER_MINUTES = 120;
const MAX_SNOOZES = 3;
const ALLOWED_SNOOZE_MINUTES = [10, 15, 30, 60, 120];
const ALLOWED_MISSED_AFTER_MINUTES = [60, 120, 180, 360];

const HOUR_MS = 3600000;
const DAY_MS = 86400000;
const MINUTE_MS = 60000;
// Largest window before a dose's slot in which an already-recorded administration still counts
// as "that dose" (so confirming a little early, or via the older Confirm button, resolves it).
const MAX_EARLY_CONFIRM_MS = 6 * HOUR_MS;

const resolveTimeZone = (tz) => {
    if (!tz || typeof tz !== 'string') return 'UTC';
    try {
        new Intl.DateTimeFormat('en-US', { timeZone: tz });
        return tz;
    } catch (err) {
        return 'UTC';
    }
};

const isValidTimeZone = (tz) => typeof tz === 'string' && tz.length > 0 && resolveTimeZone(tz) === tz;

const normalizeDoseTime = (value) => (
    typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value) ? value : DEFAULT_DOSE_TIME
);

// Offset (ms) of `tz` from UTC at the instant `ms` (positive east of UTC).
const tzOffsetMs = (ms, tz) => {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: tz, hourCycle: 'h23',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
    }).formatToParts(new Date(ms));
    const get = (type) => Number(parts.find((p) => p.type === type).value);
    const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
    return asUtc - Math.floor(ms / 1000) * 1000;
};

// Converts a wall-clock date ("YYYY-MM-DD") + time ("HH:MM") in `tz` to a UTC epoch ms.
const zonedTimeToUtc = (dateStr, timeStr, tz) => {
    const [y, m, d] = dateStr.split('-').map(Number);
    const [hh, mm] = timeStr.split(':').map(Number);
    const wall = Date.UTC(y, m - 1, d, hh, mm);
    const firstOffset = tzOffsetMs(wall, tz);
    let utc = wall - firstOffset;
    const secondOffset = tzOffsetMs(utc, tz);
    if (secondOffset !== firstOffset) utc = wall - secondOffset; // crossed a DST change
    return utc;
};

// "YYYY-MM-DD" of the instant `ms` as seen in `tz`.
const localDateString = (ms, tz) => {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' })
        .formatToParts(new Date(ms));
    const get = (type) => parts.find((p) => p.type === type).value;
    return `${get('year')}-${get('month')}-${get('day')}`;
};

const addDaysToDateString = (dateStr, days) => {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
};

const daysBetweenDateStrings = (fromStr, toStr) => {
    const [fy, fm, fd] = fromStr.split('-').map(Number);
    const [ty, tm, td] = toStr.split('-').map(Number);
    return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / DAY_MS);
};

// Interval length in ms (months are treated as 30 days, matching the rest of the app), or null.
const medIntervalMs = (med) => {
    const value = Number(med?.intervalValue);
    if (!value || value <= 0) return null;
    const unitMs = med.intervalUnit === 'hours' ? HOUR_MS
        : med.intervalUnit === 'days' ? DAY_MS
        : med.intervalUnit === 'weeks' ? 7 * DAY_MS
        : med.intervalUnit === 'months' ? 30 * DAY_MS : null;
    return unitMs ? value * unitMs : null;
};

const isMedActive = (med) => !med?.status || med.status === 'active';

// A stored date-only value (startDate/stopDate) as a calendar date string. These come from a
// date-only input, so the UTC calendar date is the date the user picked.
const calendarDateString = (value) => {
    if (!value) return null;
    const d = new Date(value);
    if (isNaN(d.getTime())) return null;
    return d.toISOString().slice(0, 10);
};

// Epoch ms of the LATEST scheduled dose at or before `nowMs`, or null if there is none (not started
// yet, no valid interval, or that dose falls on/after the medication's stop date).
const latestDueSlot = (med, nowMs, tz) => {
    const zone = resolveTimeZone(tz);
    const intervalMs = medIntervalMs(med);
    const startStr = calendarDateString(med?.startDate);
    if (!intervalMs || !startStr) return null;
    const doseTime = normalizeDoseTime(med.doseTime);

    let slot;
    if (med.intervalUnit === 'hours') {
        const anchor = zonedTimeToUtc(startStr, doseTime, zone);
        if (nowMs < anchor) return null;
        slot = anchor + Math.floor((nowMs - anchor) / intervalMs) * intervalMs;
    } else {
        // Day-based intervals step by calendar day so the dose stays at the same local time across DST.
        const stepDays = Math.round(intervalMs / DAY_MS);
        const diffDays = daysBetweenDateStrings(startStr, localDateString(nowMs, zone));
        if (diffDays < 0) return null;
        let k = Math.floor(diffDays / stepDays);
        slot = zonedTimeToUtc(addDaysToDateString(startStr, k * stepDays), doseTime, zone);
        if (slot > nowMs) {
            k -= 1;
            if (k < 0) return null;
            slot = zonedTimeToUtc(addDaysToDateString(startStr, k * stepDays), doseTime, zone);
        }
    }

    const stopStr = calendarDateString(med.stopDate);
    if (stopStr && slot >= zonedTimeToUtc(stopStr, '00:00', zone)) return null;
    return slot;
};

// Half the interval, capped: how far BEFORE a slot an administration still counts as that dose.
const earlyConfirmWindowMs = (med) => {
    const intervalMs = medIntervalMs(med);
    return intervalMs ? Math.min(intervalMs / 2, MAX_EARLY_CONFIRM_MS) : 0;
};

// The earliest recorded administration that counts as the dose due at `slotMs` (so confirming a
// little early, or via the older Confirm button, resolves it), or null when the dose is uncovered.
const coveringAdministrationDate = (med, slotMs) => {
    const window = earlyConfirmWindowMs(med);
    if (!window) return null;
    const times = (med.administrations || [])
        .map((a) => new Date(a?.date).getTime())
        .filter((t) => !isNaN(t) && t >= slotMs - window);
    return times.length ? new Date(Math.min(...times)) : null;
};

// Escalation ladder, as minutes after the (possibly snoozed) clock start: reminder, nudge, final alert.
// With the default 120-minute "missed after": 0 / 30 / 90.
const escalationOffsets = (missedAfterMinutes) => [
    0,
    Math.round(missedAfterMinutes * 0.25),
    Math.round(missedAfterMinutes * 0.75),
];

// Decides what the scheduler should do next for a pending dose event.
//   { action: 'missed' }                 deadline reached
//   { action: 'notify', stage: 1|2|3 }   a new escalation step is due
//   { action: 'wait' }                   nothing to do yet (including while snoozed)
// The deadline is the earlier of (clockStart + missedAfter) and the next dose's slot, so a
// short-interval medication is never "pending" past its own next dose.
const evaluateEvent = ({ event, nowMs, missedAfterMinutes, intervalMs }) => {
    const scheduledMs = new Date(event.scheduledAt).getTime();
    const clockMs = new Date(event.clockStart || event.scheduledAt).getTime();
    const deadline = Math.min(clockMs + missedAfterMinutes * MINUTE_MS, intervalMs ? scheduledMs + intervalMs : Infinity);
    if (nowMs >= deadline) return { action: 'missed' };
    const elapsedMinutes = (nowMs - clockMs) / MINUTE_MS;
    if (elapsedMinutes < 0) return { action: 'wait' };
    const targetStage = escalationOffsets(missedAfterMinutes).filter((offset) => elapsedMinutes >= offset).length;
    if (targetStage > (event.stage || 0)) return { action: 'notify', stage: targetStage };
    return { action: 'wait' };
};

// Fields to apply when the user snoozes: the reminder re-fires at `snoozedUntil` and the escalation
// ladder restarts from there.
const snoozeUpdate = (event, nowMs, minutes) => {
    const until = new Date(nowMs + minutes * MINUTE_MS);
    return {
        snoozedUntil: until,
        clockStart: until,
        stage: 0,
        snoozeCount: (event.snoozeCount || 0) + 1,
    };
};

const buildReminderMessage = (stage, { animalName, medName, dose }) => {
    const what = `${animalName || 'Your animal'}: ${medName || 'medication'}${dose ? ` (${dose})` : ''}`;
    if (stage >= 3) return { title: 'Final reminder: medication due', body: `${what} is still not marked as given and will be recorded as missed soon.` };
    if (stage === 2) return { title: 'Medication still due', body: `${what} hasn't been marked as given yet.` };
    return { title: 'Medication due', body: `${what} is due now.` };
};

module.exports = {
    DEFAULT_DOSE_TIME, DEFAULT_SNOOZE_MINUTES, DEFAULT_MISSED_AFTER_MINUTES, MAX_SNOOZES,
    ALLOWED_SNOOZE_MINUTES, ALLOWED_MISSED_AFTER_MINUTES,
    resolveTimeZone, isValidTimeZone, normalizeDoseTime, zonedTimeToUtc, localDateString,
    addDaysToDateString, daysBetweenDateStrings, medIntervalMs, isMedActive, calendarDateString,
    latestDueSlot, earlyConfirmWindowMs, coveringAdministrationDate,
    escalationOffsets, evaluateEvent, snoozeUpdate, buildReminderMessage,
};
