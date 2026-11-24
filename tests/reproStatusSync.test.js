const test = require('node:test');
const assert = require('node:assert/strict');
const {
    shouldAutoConfirmWeaning,
    getLitterReproStatus,
    DEFAULT_MAX_NURSING_DAYS,
    WEANING_AUTO_CONFIRM_GRACE_PCT,
} = require('../utils/reproStatusSync');

const NOW = new Date('2026-03-01T12:00:00Z');
const DAY = 86400000;
const agoISO = (days) => new Date(NOW.getTime() - days * DAY).toISOString();

test('50% grace: confirms half a weaning age past the expected weaning date', () => {
    const weaningAge = 31; // Fancy Mouse
    // weaningDate = birth + 31; with birth 40 days ago, weaningDate is 9 days ago.
    const beforeGrace = {
        birthDate: agoISO(40),
        weaningDate: agoISO(9), // 9 days ago -> the 15.5d grace has not yet elapsed
        weaningAge,
    };
    assert.equal(shouldAutoConfirmWeaning(beforeGrace, NOW), false);

    // weaningDate 19 days ago -> past the 15.5 day grace.
    const afterGrace = {
        birthDate: agoISO(50),
        weaningDate: agoISO(19),
        weaningAge,
    };
    assert.equal(shouldAutoConfirmWeaning(afterGrace, NOW), true);
});

test('fallback to maxNursingDays when there is no weaning age or no weaning date', () => {
    // no weaning age -> use maxNursingDays (default 90 via ??)
    assert.equal(
        shouldAutoConfirmWeaning({ birthDate: agoISO(30), weaningDate: null, weaningAge: null }, NOW),
        false
    );
    assert.equal(
        shouldAutoConfirmWeaning({ birthDate: agoISO(95), weaningDate: null, weaningAge: null }, NOW),
        true
    );

    // has a weaning age but no recorded weaning date -> fall back to maxNursingDays
    assert.equal(
        shouldAutoConfirmWeaning({ birthDate: agoISO(100), weaningDate: null, weaningAge: 31, maxNursingDays: 35 }, NOW),
        true
    );
});

test('honours an explicit maxNursingDays in the fallback', () => {
    assert.equal(
        shouldAutoConfirmWeaning({ birthDate: agoISO(40), weaningDate: null, weaningAge: null, maxNursingDays: 35 }, NOW),
        true
    );
    assert.equal(
        shouldAutoConfirmWeaning({ birthDate: agoISO(34), weaningDate: null, weaningAge: null, maxNursingDays: 35 }, NOW),
        false
    );
});

test('never confirms already-weaned, lost, or dateless litters', () => {
    assert.equal(shouldAutoConfirmWeaning({ birthDate: agoISO(200), weaningConfirmed: true }, NOW), false);
    assert.equal(shouldAutoConfirmWeaning({ birthDate: agoISO(200), pregnancyLost: true }, NOW), false);
    assert.equal(shouldAutoConfirmWeaning({ birthDate: null, weaningConfirmed: false }, NOW), false);
    assert.equal(shouldAutoConfirmWeaning(null, NOW), false);
});

test('getLitterReproStatus: nursing before the cut-off, closed (null) past it', () => {
    const nursing = { birthDate: agoISO(10), weaningConfirmed: false };
    assert.equal(getLitterReproStatus(nursing, NOW, DEFAULT_MAX_NURSING_DAYS), 'nursing');
    const past = { birthDate: agoISO(120), weaningConfirmed: false };
    assert.equal(getLitterReproStatus(past, NOW, DEFAULT_MAX_NURSING_DAYS), null);
    const weaned = { birthDate: agoISO(10), weaningConfirmed: true };
    assert.equal(getLitterReproStatus(weaned, NOW, DEFAULT_MAX_NURSING_DAYS), null);
});

test('WEANING_AUTO_CONFIRM_GRACE_PCT defaults to 50%', () => {
    assert.equal(WEANING_AUTO_CONFIRM_GRACE_PCT, 0.5);
});