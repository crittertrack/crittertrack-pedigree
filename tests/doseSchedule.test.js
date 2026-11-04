const test = require('node:test');
const assert = require('node:assert/strict');
const {
    zonedTimeToUtc, latestDueSlot, coveringAdministrationDate, escalationOffsets,
    evaluateEvent, snoozeUpdate, isValidTimeZone, resolveTimeZone, normalizeDoseTime,
    buildReminderMessage,
} = require('../utils/doseSchedule');

const iso = (ms) => new Date(ms).toISOString();
const MIN = 60000;

test('zonedTimeToUtc converts wall-clock time in a zone to UTC', () => {
    assert.equal(iso(zonedTimeToUtc('2026-01-15', '08:00', 'UTC')), '2026-01-15T08:00:00.000Z');
    assert.equal(iso(zonedTimeToUtc('2026-01-15', '08:00', 'America/New_York')), '2026-01-15T13:00:00.000Z');
    // Summer time in New York is UTC-4.
    assert.equal(iso(zonedTimeToUtc('2026-07-15', '08:00', 'America/New_York')), '2026-07-15T12:00:00.000Z');
    assert.equal(iso(zonedTimeToUtc('2026-07-15', '08:00', 'Australia/Sydney')), '2026-07-14T22:00:00.000Z');
});

test('time zone helpers fall back safely', () => {
    assert.equal(isValidTimeZone('Europe/Paris'), true);
    assert.equal(isValidTimeZone('Not/AZone'), false);
    assert.equal(resolveTimeZone('Not/AZone'), 'UTC');
    assert.equal(resolveTimeZone(null), 'UTC');
    assert.equal(normalizeDoseTime('7:00'), '08:00');
    assert.equal(normalizeDoseTime('19:30'), '19:30');
});

test('hourly medication: slots follow the fixed schedule from the start time', () => {
    const med = { startDate: '2026-03-01', doseTime: '06:00', intervalValue: 8, intervalUnit: 'hours' };
    const now = Date.parse('2026-03-01T15:10:00Z');
    assert.equal(iso(latestDueSlot(med, now, 'UTC')), '2026-03-01T14:00:00.000Z');
    assert.equal(iso(latestDueSlot(med, Date.parse('2026-03-01T06:00:00Z'), 'UTC')), '2026-03-01T06:00:00.000Z');
    assert.equal(latestDueSlot(med, Date.parse('2026-03-01T05:59:00Z'), 'UTC'), null);
});

test('daily medication keeps the same local time across a DST change', () => {
    const med = { startDate: '2026-03-01', doseTime: '08:00', intervalValue: 1, intervalUnit: 'days' };
    // US DST began 2026-03-08: 08:00 local is 13:00Z before and 12:00Z after.
    assert.equal(iso(latestDueSlot(med, Date.parse('2026-03-07T20:00:00Z'), 'America/New_York')), '2026-03-07T13:00:00.000Z');
    assert.equal(iso(latestDueSlot(med, Date.parse('2026-03-09T20:00:00Z'), 'America/New_York')), '2026-03-09T12:00:00.000Z');
});

test('multi-day and weekly intervals land on the right days', () => {
    const every3 = { startDate: '2026-03-01', doseTime: '09:00', intervalValue: 3, intervalUnit: 'days' };
    assert.equal(iso(latestDueSlot(every3, Date.parse('2026-03-06T12:00:00Z'), 'UTC')), '2026-03-04T09:00:00.000Z');
    // Before today's dose time the latest slot is the previous one.
    assert.equal(iso(latestDueSlot(every3, Date.parse('2026-03-07T08:00:00Z'), 'UTC')), '2026-03-04T09:00:00.000Z');
    assert.equal(iso(latestDueSlot(every3, Date.parse('2026-03-07T09:00:00Z'), 'UTC')), '2026-03-07T09:00:00.000Z');
    const weekly = { startDate: '2026-03-01', intervalValue: 1, intervalUnit: 'weeks' };
    assert.equal(iso(latestDueSlot(weekly, Date.parse('2026-03-20T12:00:00Z'), 'UTC')), '2026-03-15T08:00:00.000Z');
});

test('no slot before the start date, after the stop date, or without a valid interval', () => {
    const med = { startDate: '2026-03-10', stopDate: '2026-03-12', intervalValue: 1, intervalUnit: 'days' };
    assert.equal(latestDueSlot(med, Date.parse('2026-03-09T20:00:00Z'), 'UTC'), null);
    assert.equal(iso(latestDueSlot(med, Date.parse('2026-03-11T20:00:00Z'), 'UTC')), '2026-03-11T08:00:00.000Z');
    assert.equal(latestDueSlot(med, Date.parse('2026-03-12T09:00:00Z'), 'UTC'), null);
    assert.equal(latestDueSlot({ startDate: '2026-03-10' }, Date.now(), 'UTC'), null);
    assert.equal(latestDueSlot({ intervalValue: 1, intervalUnit: 'days' }, Date.now(), 'UTC'), null);
});

test('coveringAdministrationDate counts a slightly early confirmation but not an old one', () => {
    const med = {
        intervalValue: 8, intervalUnit: 'hours',
        administrations: [{ date: '2026-03-01T05:40:00Z' }, { date: '2026-03-01T10:00:00Z' }],
    };
    const slot = Date.parse('2026-03-01T14:00:00Z');
    // 4h window (half of 8h): 10:00 counts, 05:40 does not.
    assert.equal(iso(coveringAdministrationDate(med, slot)), '2026-03-01T10:00:00.000Z');
    assert.equal(coveringAdministrationDate({ ...med, administrations: [{ date: '2026-03-01T05:40:00Z' }] }, slot), null);
    assert.equal(coveringAdministrationDate({ ...med, administrations: [] }, slot), null);
});

test('escalation ladder offsets scale with the missed-after window', () => {
    assert.deepEqual(escalationOffsets(120), [0, 30, 90]);
    assert.deepEqual(escalationOffsets(60), [0, 15, 45]);
});

test('evaluateEvent walks reminder -> nudge -> final -> missed', () => {
    const scheduledAt = new Date('2026-03-01T08:00:00Z');
    const base = { scheduledAt, clockStart: scheduledAt, stage: 0, snoozeCount: 0 };
    const at = (minutes, event = base) => evaluateEvent({
        event, nowMs: scheduledAt.getTime() + minutes * MIN, missedAfterMinutes: 120, intervalMs: 24 * 60 * MIN,
    });
    assert.deepEqual(at(0), { action: 'notify', stage: 1 });
    assert.deepEqual(at(10, { ...base, stage: 1 }), { action: 'wait' });
    assert.deepEqual(at(30, { ...base, stage: 1 }), { action: 'notify', stage: 2 });
    assert.deepEqual(at(95, { ...base, stage: 2 }), { action: 'notify', stage: 3 });
    assert.deepEqual(at(100, { ...base, stage: 3 }), { action: 'wait' });
    assert.deepEqual(at(120, { ...base, stage: 3 }), { action: 'missed' });
});

test('a delayed scheduler run jumps straight to the right stage', () => {
    const scheduledAt = new Date('2026-03-01T08:00:00Z');
    const event = { scheduledAt, clockStart: scheduledAt, stage: 0 };
    const result = evaluateEvent({ event, nowMs: scheduledAt.getTime() + 100 * MIN, missedAfterMinutes: 120, intervalMs: 24 * 60 * MIN });
    assert.deepEqual(result, { action: 'notify', stage: 3 });
});

test('a short interval caps the deadline at the next dose', () => {
    const scheduledAt = new Date('2026-03-01T08:00:00Z');
    const event = { scheduledAt, clockStart: scheduledAt, stage: 3 };
    const result = evaluateEvent({ event, nowMs: scheduledAt.getTime() + 60 * MIN, missedAfterMinutes: 120, intervalMs: 60 * MIN });
    assert.deepEqual(result, { action: 'missed' });
});

test('snooze restarts the escalation clock and does not notify while snoozed', () => {
    const scheduledAt = new Date('2026-03-01T08:00:00Z');
    const nowMs = scheduledAt.getTime() + 5 * MIN;
    const event = { scheduledAt, clockStart: scheduledAt, stage: 1, snoozeCount: 0 };
    const update = snoozeUpdate(event, nowMs, 30);
    assert.equal(update.stage, 0);
    assert.equal(update.snoozeCount, 1);
    assert.equal(update.snoozedUntil.getTime(), nowMs + 30 * MIN);
    const snoozed = { ...event, ...update };
    const args = { missedAfterMinutes: 120, intervalMs: 24 * 60 * MIN };
    assert.deepEqual(evaluateEvent({ event: snoozed, nowMs: nowMs + 10 * MIN, ...args }), { action: 'wait' });
    assert.deepEqual(evaluateEvent({ event: snoozed, nowMs: nowMs + 30 * MIN, ...args }), { action: 'notify', stage: 1 });
    // Deadline restarts from the snooze end, not the original slot.
    assert.deepEqual(evaluateEvent({ event: { ...snoozed, stage: 3 }, nowMs: nowMs + 30 * MIN + 119 * MIN, ...args }), { action: 'wait' });
    assert.deepEqual(evaluateEvent({ event: { ...snoozed, stage: 3 }, nowMs: nowMs + 30 * MIN + 120 * MIN, ...args }), { action: 'missed' });
});

test('reminder messages get more urgent with each stage', () => {
    const info = { animalName: 'Luna', medName: 'Meloxicam', dose: '0.1ml' };
    assert.match(buildReminderMessage(1, info).body, /Luna: Meloxicam \(0\.1ml\) is due now/);
    assert.match(buildReminderMessage(2, info).title, /still due/);
    assert.match(buildReminderMessage(3, info).body, /recorded as missed/);
});
