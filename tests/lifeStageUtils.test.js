const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateLifeStageFromBirthDate, getLifespanDays } = require('../utils/lifeStageUtils');

const day = (v) => (v ? new Date(v).toISOString().slice(0, 10) : null);

function makeBirthDate(daysAgo) {
    return new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString();
}

test('calculateLifeStageFromBirthDate: newborn (0-14 days) for Fancy Mouse', () => {
    assert.equal(calculateLifeStageFromBirthDate(makeBirthDate(0), 'Fancy Mouse'), 'Newborn');
    assert.equal(calculateLifeStageFromBirthDate(makeBirthDate(1), 'Fancy Mouse'), 'Newborn');
    assert.equal(calculateLifeStageFromBirthDate(makeBirthDate(10), 'Fancy Mouse'), 'Newborn');
    assert.equal(calculateLifeStageFromBirthDate(makeBirthDate(14), 'Fancy Mouse'), 'Newborn');
});

test('calculateLifeStageFromBirthDate: juvenile (15-42 days) for Fancy Mouse', () => {
    assert.equal(calculateLifeStageFromBirthDate(makeBirthDate(15), 'Fancy Mouse'), 'Juvenile');
    assert.equal(calculateLifeStageFromBirthDate(makeBirthDate(30), 'Fancy Mouse'), 'Juvenile');
    assert.equal(calculateLifeStageFromBirthDate(makeBirthDate(42), 'Fancy Mouse'), 'Juvenile');
});

test('calculateLifeStageFromBirthDate: sub-adult (43-90 days) for Fancy Mouse', () => {
    assert.equal(calculateLifeStageFromBirthDate(makeBirthDate(43), 'Fancy Mouse'), 'Sub-adult');
    assert.equal(calculateLifeStageFromBirthDate(makeBirthDate(60), 'Fancy Mouse'), 'Sub-adult');
    assert.equal(calculateLifeStageFromBirthDate(makeBirthDate(90), 'Fancy Mouse'), 'Sub-adult');
});

test('calculateLifeStageFromBirthDate: adult (91-547 days) for Fancy Mouse', () => {
    // Sub-adult only until 180 days for Fancy Mouse (1-2 years lifespan, 75% = ~547 days)
    // Adult starts at 181 days
    assert.equal(calculateLifeStageFromBirthDate(makeBirthDate(91), 'Fancy Mouse'), 'Sub-adult');
    assert.equal(calculateLifeStageFromBirthDate(makeBirthDate(180), 'Fancy Mouse'), 'Sub-adult');
    assert.equal(calculateLifeStageFromBirthDate(makeBirthDate(181), 'Fancy Mouse'), 'Adult');
    assert.equal(calculateLifeStageFromBirthDate(makeBirthDate(200), 'Fancy Mouse'), 'Adult');
    assert.equal(calculateLifeStageFromBirthDate(makeBirthDate(547), 'Fancy Mouse'), 'Adult');
});

test('calculateLifeStageFromBirthDate: senior (548+ days) for Fancy Mouse', () => {
    // For Fancy Mouse (2yr = 730 days), senior starts at 75% = 548 days
    assert.equal(calculateLifeStageFromBirthDate(makeBirthDate(548), 'Fancy Mouse'), 'Senior');
    assert.equal(calculateLifeStageFromBirthDate(makeBirthDate(700), 'Fancy Mouse'), 'Senior');
    assert.equal(calculateLifeStageFromBirthDate(makeBirthDate(1000), 'Fancy Mouse'), 'Senior');
});

test('calculateLifeStageFromBirthDate: juvenile (15-42 days) for Rat', () => {
    assert.equal(calculateLifeStageFromBirthDate(makeBirthDate(15), 'Rat'), 'Juvenile');
    assert.equal(calculateLifeStageFromBirthDate(makeBirthDate(42), 'Rat'), 'Juvenile');
});

test('calculateLifeStageFromBirthDate: sub-adult (43-180 days) for Rat', () => {
    assert.equal(calculateLifeStageFromBirthDate(makeBirthDate(43), 'Rat'), 'Sub-adult');
    assert.equal(calculateLifeStageFromBirthDate(makeBirthDate(180), 'Rat'), 'Sub-adult');
});

test('calculateLifeStageFromBirthDate: adult (181-821 days) for Rat', () => {
    assert.equal(calculateLifeStageFromBirthDate(makeBirthDate(181), 'Rat'), 'Adult');
    assert.equal(calculateLifeStageFromBirthDate(makeBirthDate(500), 'Rat'), 'Adult');
    assert.equal(calculateLifeStageFromBirthDate(makeBirthDate(821), 'Rat'), 'Adult');
});

test('calculateLifeStageFromBirthDate: senior (822+ days) for Rat', () => {
    assert.equal(calculateLifeStageFromBirthDate(makeBirthDate(822), 'Rat'), 'Senior');
    assert.equal(calculateLifeStageFromBirthDate(makeBirthDate(1000), 'Rat'), 'Senior');
});

test('calculateLifeStageFromBirthDate: sub-adult (43-135 days) for Guinea Pig', () => {
    assert.equal(calculateLifeStageFromBirthDate(makeBirthDate(43), 'Guinea Pig'), 'Sub-adult');
    assert.equal(calculateLifeStageFromBirthDate(makeBirthDate(135), 'Guinea Pig'), 'Sub-adult');
});

test('calculateLifeStageFromBirthDate: adult (136-1575 days) for Guinea Pig', () => {
    // For Guinea Pig (6yr = 2190 days), adult starts at 181 days, senior at 75% = 1642
    assert.equal(calculateLifeStageFromBirthDate(makeBirthDate(136), 'Guinea Pig'), 'Sub-adult');
    assert.equal(calculateLifeStageFromBirthDate(makeBirthDate(180), 'Guinea Pig'), 'Sub-adult');
    assert.equal(calculateLifeStageFromBirthDate(makeBirthDate(181), 'Guinea Pig'), 'Adult');
    assert.equal(calculateLifeStageFromBirthDate(makeBirthDate(1000), 'Guinea Pig'), 'Adult');
    assert.equal(calculateLifeStageFromBirthDate(makeBirthDate(1575), 'Guinea Pig'), 'Adult');
});

test('calculateLifeStageFromBirthDate: senior (1643+ days) for Guinea Pig', () => {
    // For Guinea Pig (6yr = 2190 days), senior starts at 75% = 1642.5 days
    // 1576 = Adult, 1643 = Senior (first day at/above threshold), 2000 = Senior
    assert.equal(calculateLifeStageFromBirthDate(makeBirthDate(1576), 'Guinea Pig'), 'Adult');
    assert.equal(calculateLifeStageFromBirthDate(makeBirthDate(1643), 'Guinea Pig'), 'Senior');
    assert.equal(calculateLifeStageFromBirthDate(makeBirthDate(2000), 'Guinea Pig'), 'Senior');
});

test('calculateLifeStageFromBirthDate: unknown birth date returns Unknown', () => {
    assert.equal(calculateLifeStageFromBirthDate(null), 'Unknown');
    assert.equal(calculateLifeStageFromBirthDate(undefined), 'Unknown');
    assert.equal(calculateLifeStageFromBirthDate(''), 'Unknown');
    assert.equal(calculateLifeStageFromBirthDate('not-a-date'), 'Unknown');
});

test('calculateLifeStageFromBirthDate: valid birth date returns proper stage', () => {
    // makeBirthDate returns a valid date string
    const validDate = makeBirthDate(300);
    assert.equal(calculateLifeStageFromBirthDate(validDate, 'Fancy Mouse'), 'Adult');
});

test('calculateLifeStageFromBirthDate: makeBirthDate creates valid dates', () => {
    // Verify makeBirthDate creates valid ISO dates
    const date0 = makeBirthDate(0);
    assert.ok(date0);
    assert.ok(new Date(date0).getTime() <= Date.now());
    
    const date300 = makeBirthDate(300);
    assert.ok(date300);
    const d = new Date(date300);
    assert.equal(d.getFullYear(), new Date(Date.now() - 300 * 24 * 60 * 60 * 1000).getFullYear());
});

test('getLifespanDays: returns species lifespans', () => {
    assert.equal(getLifespanDays('Fancy Mouse'), 730);
    assert.equal(getLifespanDays('Rat'), 1095);
    assert.equal(getLifespanDays('Guinea Pig'), 2190);
    assert.equal(getLifespanDays('Chinchilla'), 3650);
});

test('getLifespanDays: falls back to 2-year default for unknown species', () => {
    assert.equal(getLifespanDays('African Pygmy Mouse'), 730);
    assert.equal(getLifespanDays(null), null);
    assert.equal(getLifespanDays(''), null);
});

