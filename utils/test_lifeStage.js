/**
 * Test file for life stage calculation utilities.
 * Tests life stage determination based on species and birth date.
 */
test('calculateLifeStageFromBirthDate: Fancy Mouse sub-adult (43-90 days)', () => {
    const birthDate = daysAgo(60); // 60 days ago
    const stage = calculateLifeStageFromBirthDate(birthDate, 'Fancy Mouse');
    assert.strictEqual(stage, 'Sub-adult');
});

test('calculateLifeStageFromBirthDate: Fancy Mouse adult (91-547 days)', () => {
    const birthDate = daysAgo(200); // 200 days ago
    const stage = calculateLifeStageFromBirthDate(birthDate, 'Fancy Mouse');
    assert.strictEqual(stage, 'Adult');
});

test('calculateLifeStageFromBirthDate: Fancy Mouse senior (548+ days)', () => {
    const birthDate = daysAgo(600); // 600 days ago
    const stage = calculateLifeStageFromBirthDate(birthDate, 'Fancy Mouse');
    assert.strictEqual(stage, 'Senior');
});

test('calculateLifeStageFromBirthDate: Fancy Rat newborn (0-21 days)', () => {
    const birthDate = daysAgo(10);
    const stage = calculateLifeStageFromBirthDate(birthDate, 'Fancy Rat');
    assert.strictEqual(stage, 'Newborn');
});

test('calculateLifeStageFromBirthDate: Fancy Rat juvenile (22-42 days)', () => {
    const birthDate = daysAgo(30);
    const stage = calculateLifeStageFromBirthDate(birthDate, 'Fancy Rat');
    assert.strictEqual(stage, 'Juvenile');
});

test('calculateLifeStageFromBirthDate: Russian Hamster newborn (0-14 days)', () => {
    const birthDate = daysAgo(5);
    const stage = calculateLifeStageFromBirthDate(birthDate, 'Russian Hamster');
    assert.strictEqual(stage, 'Newborn');
});

test('calculateLifeStageFromBirthDate: Russian Hamster juvenile (15-42 days)', () => {
    const birthDate = daysAgo(30);
    const stage = calculateLifeStageFromBirthDate(birthDate, 'Russian Hamster');
    assert.strictEqual(stage, 'Juvenile');
});

test('calculateLifeStageFromBirthDate: Russian Hamster sub-adult (43-90 days)', () => {
    const birthDate = daysAgo(60);
    const stage = calculateLifeStageFromBirthDate(birthDate, 'Russian Hamster');
    assert.strictEqual(stage, 'Sub-adult');
});

test('calculateLifeStageFromBirthDate: Russian Hamster adult (91-547 days)', () => {
    const birthDate = daysAgo(200);
    const stage = calculateLifeStageFromBirthDate(birthDate, 'Russian Hamster');
    assert.strictEqual(stage, 'Adult');
});

test('calculateLifeStageFromBirthDate: Russian Hamster senior (548+ days)', () => {
    const birthDate = daysAgo(600);
    const stage = calculateLifeStageFromBirthDate(birthDate, 'Russian Hamster');
    assert.strictEqual(stage, 'Senior');
});

test('calculateLifeStageFromBirthDate: Campbell Hamster newborn', () => {
    const birthDate = daysAgo(5);
    const stage = calculateLifeStageFromBirthDate(birthDate, "Campbell's Hamster");
    assert.strictEqual(stage, 'Newborn');
});

test('calculateLifeStageFromBirthDate: Campbell Hamster juvenile', () => {
    const birthDate = daysAgo(30);
    const stage = calculateLifeStageFromBirthDate(birthDate, "Campbell's Hamster");
    assert.strictEqual(stage, 'Juvenile');
});

test('calculateLifeStageFromBirthDate: Chinese Hamster newborn', () => {
    const birthDate = daysAgo(5);
    const stage = calculateLifeStageFromBirthDate(birthDate, 'Chinese Hamster');
    assert.strictEqual(stage, 'Newborn');
});

test('calculateLifeStageFromBirthDate: Chinese Hamster juvenile', () => {
    const birthDate = daysAgo(30);
    const stage = calculateLifeStageFromBirthDate(birthDate, 'Chinese Hamster');
    assert.strictEqual(stage, 'Juvenile');
});

test('calculateLifeStageFromBirthDate: Guinea Pig newborn (0-14 days)', () => {
    const birthDate = daysAgo(5);
    const stage = calculateLifeStageFromBirthDate(birthDate, 'Guinea Pig');
    assert.strictEqual(stage, 'Newborn');
});

test('calculateLifeStageFromBirthDate: Guinea Pig juvenile (15-42 days)', () => {
    const birthDate = daysAgo(30);
    const stage = calculateLifeStageFromBirthDate(birthDate, 'Guinea Pig');
    assert.strictEqual(stage, 'Juvenile');
});

test('calculateLifeStageFromBirthDate: Guinea Pig sub-adult (43-180 days)', () => {
    const birthDate = daysAgo(90);
    const stage = calculateLifeStageFromBirthDate(birthDate, 'Guinea Pig');
    assert.strictEqual(stage, 'Sub-adult');
});

test('calculateLifeStageFromBirthDate: Guinea Pig adult (181-1400 days)', () => {
    const birthDate = daysAgo(500);
    const stage = calculateLifeStageFromBirthDate(birthDate, 'Guinea Pig');
    assert.strictEqual(stage, 'Adult');
});

test('calculateLifeStageFromBirthDate: Guinea Pig senior (1401+ days)', () => {
    const birthDate = daysAgo(1500);
    const stage = calculateLifeStageFromBirthDate(birthDate, 'Guinea Pig');
    assert.strictEqual(stage, 'Senior');
});

test('calculateLifeStageFromBirthDate: unknown species returns Unknown', () => {
    const birthDate = daysAgo(30);
    const stage = calculateLifeStageFromBirthDate(birthDate, 'Unknown Species');
    assert.strictEqual(stage, 'Unknown');
});

test('calculateLifeStageFromBirthDate: null birthDate returns Unknown', () => {
    const stage = calculateLifeStageFromBirthDate(null, 'Fancy Mouse');
    assert.strictEqual(stage, 'Unknown');
});

test('calculateLifeStageFromBirthDate: invalid birthDate returns Unknown', () => {
    const stage = calculateLifeStageFromBirthDate('not-a-date', 'Fancy Mouse');
    assert.strictEqual(stage, 'Unknown');
});

test('getLifeStageThresholds returns correct thresholds for Russian Hamster', () => {
    const thresholds = getLifeStageThresholds('Russian Hamster');
    assert.notStrictEqual(thresholds, null);
    assert.strictEqual(thresholds.newborn, 14);
    assert.strictEqual(thresholds.juvenile, 42);
    assert.strictEqual(thresholds.sub_adult, 90);
    assert.strictEqual(thresholds.senior_pct, 0.75);
});

test('getLifeStageThresholds returns correct thresholds for Campbell Hamster', () => {
    const thresholds = getLifeStageThresholds("Campbell's Hamster");
    assert.notStrictEqual(thresholds, null);
    assert.strictEqual(thresholds.newborn, 14);
    assert.strictEqual(thresholds.juvenile, 42);
    assert.strictEqual(thresholds.sub_adult, 90);
    assert.strictEqual(thresholds.senior_pct, 0.75);
});

test('getLifeStageThresholds returns correct thresholds for Chinese Hamster', () => {
    const thresholds = getLifeStageThresholds('Chinese Hamster');
    assert.notStrictEqual(thresholds, null);
    assert.strictEqual(thresholds.newborn, 14);
    assert.strictEqual(thresholds.juvenile, 42);
    assert.strictEqual(thresholds.sub_adult, 90);
    assert.strictEqual(thresholds.senior_pct, 0.75);
});

test('getLifeStageThresholds returns generic defaults for unrecognized species', () => {
    const thresholds = getLifeStageThresholds('Some Random Species');
    assert.notStrictEqual(thresholds, null);
    assert.strictEqual(thresholds.newborn, 21);
    assert.strictEqual(thresholds.juvenile, 42);
    assert.strictEqual(thresholds.sub_adult, 90);
    assert.strictEqual(thresholds.senior_pct, 0.75);
});

test('getLifespanDays returns positive values for new species', () => {
    const russianDays = getLifespanDays('Russian Hamster');
    const campbellDays = getLifespanDays("Campbell's Hamster");
    const chineseDays = getLifespanDays('Chinese Hamster');
    assert.ok(russianDays > 0);
    assert.ok(campbellDays > 0);
    assert.ok(chineseDays > 0);
});

test('SPECIES_LIFE_STAGE_THRESHOLDS contains new species entries', () => {
    assert.ok('russian hamster' in SPECIES_LIFE_STAGE_THRESHOLDS);
    assert.ok("campbell's hamster" in SPECIES_LIFE_STAGE_THRESHOLDS);
    assert.ok('chinese hamster' in SPECIES_LIFE_STAGE_THRESHOLDS);
});

const test = require('node:test');
const assert = require('node:assert/strict');