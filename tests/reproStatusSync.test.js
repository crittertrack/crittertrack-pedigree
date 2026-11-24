const test = require('node:test');
const assert = require('node:assert/strict');
const {
    shouldAutoConfirmWeaning,
    getLitterReproStatus,
    DEFAULT_MAX_NURSING_DAYS,
} = require('../utils/reproStatusSync');

const NOW = new Date('2026-03-01T12:00:00Z');
const before = (days) => new Date(NOW.getTime() - days * 86400000).toISOString();

test('shouldAutoConfirmWeaning: false while within the cut-off, true once past it', () => {
    assert.equal(shouldAutoConfirmWeaning({ birthDate: before(10), weaningConfirmed: false }, DEFAULT_MAX_NURSING_DAYS, NOW), false);
    assert.equal(shouldAutoConfirmWeaning({ birthDate: before(90), weaningConfirmed: false }, DEFAULT_MAX_NURSING_DAYS, NOW), false);
    assert.equal(shouldAutoConfirmWeaning({ birthDate: before(91), weaningConfirmed: false }, DEFAULT_MAX_NURSING_DAYS, NOW), true);
    assert.equal(shouldAutoConfirmWeaning({ birthDate: before(200), weaningConfirmed: false }, DEFAULT_MAX_NURSING_DAYS, NOW), true);
});

test('shouldAutoConfirmWeaning: honours the species-specific cut-off', () => {
    // Fancy Mouse maxNursingDays = 35.
    assert.equal(shouldAutoConfirmWeaning({ birthDate: before(34), weaningConfirmed: false }, 35, NOW), false);
    assert.equal(shouldAutoConfirmWeaning({ birthDate: before(36), weaningConfirmed: false }, 35, NOW), true);
});

test('shouldAutoConfirmWeaning: never confirms already-weaned, lost, or dateless litters', () => {
    assert.equal(shouldAutoConfirmWeaning({ birthDate: before(200), weaningConfirmed: true }, DEFAULT_MAX_NURSING_DAYS, NOW), false);
    assert.equal(shouldAutoConfirmWeaning({ birthDate: before(200), pregnancyLost: true }, DEFAULT_MAX_NURSING_DAYS, NOW), false);
    assert.equal(shouldAutoConfirmWeaning({ birthDate: null, weaningConfirmed: false }, DEFAULT_MAX_NURSING_DAYS, NOW), false);
    assert.equal(shouldAutoConfirmWeaning(null, DEFAULT_MAX_NURSING_DAYS, NOW), false);
});

test('getLitterReproStatus: nursing before the cut-off, closed (null) past it', () => {
    const nursing = { birthDate: before(10), weaningConfirmed: false };
    assert.equal(getLitterReproStatus(nursing, NOW, DEFAULT_MAX_NURSING_DAYS), 'nursing');
    const past = { birthDate: before(120), weaningConfirmed: false };
    assert.equal(getLitterReproStatus(past, NOW, DEFAULT_MAX_NURSING_DAYS), null);
    const weaned = { birthDate: before(10), weaningConfirmed: true };
    assert.equal(getLitterReproStatus(weaned, NOW, DEFAULT_MAX_NURSING_DAYS), null);
});