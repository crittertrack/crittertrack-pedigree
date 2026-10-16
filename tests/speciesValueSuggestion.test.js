const test = require('node:test');
const assert = require('node:assert/strict');
const { validateSpeciesValueSuggestion: v, MAX_DAYS } = require('../utils/speciesValueSuggestion');

test('needs a species', () => {
    assert.match(v({ gestationDays: 20 }).error, /select a species/i);
    assert.match(v({ species: '   ', gestationDays: 20 }).error, /select a species/i);
    assert.match(v({ species: 123, gestationDays: 20 }).error, /select a species/i);
    assert.match(v().error, /select a species/i);
});

test('needs at least one duration (gestation, weaning, or both)', () => {
    assert.match(v({ species: 'Gerbil' }).error, /gestation days, weaning days, or both/i);
    assert.match(v({ species: 'Gerbil', gestationDays: '', weaningDays: '' }).error, /or both/i);
    assert.match(v({ species: 'Gerbil', gestationDays: null, weaningDays: null }).error, /or both/i);
    assert.equal(v({ species: 'Gerbil', gestationDays: 24 }).value.weaningDays, null);
    assert.equal(v({ species: 'Gerbil', weaningDays: 21 }).value.gestationDays, null);
    const both = v({ species: 'Gerbil', gestationDays: '24', weaningDays: '21' }).value;
    assert.deepEqual([both.gestationDays, both.weaningDays], [24, 21]);
});

test('durations must be whole days between 1 and the maximum', () => {
    for (const bad of [0, -3, 1.5, 'abc', MAX_DAYS + 1, NaN]) {
        assert.match(v({ species: 'Gerbil', gestationDays: bad }).error, /gestation must be a whole number/i, `gestation ${bad}`);
        assert.match(v({ species: 'Gerbil', weaningDays: bad }).error, /weaning must be a whole number/i, `weaning ${bad}`);
    }
    assert.equal(v({ species: 'Chinchilla', gestationDays: 105 }).value.gestationDays, 105);
    assert.equal(v({ species: 'X', gestationDays: MAX_DAYS }).value.gestationDays, MAX_DAYS);
});

test('a bad value is rejected even when the other duration is fine', () => {
    assert.match(v({ species: 'Gerbil', gestationDays: 24, weaningDays: 0 }).error, /weaning/i);
});

test('builds a readable summary line for the moderation panel and trims the species', () => {
    assert.equal(v({ species: '  Gerbil ', gestationDays: 24, weaningDays: 21 }).value.feedback, 'Gerbil - Gestation: 24 days, Weaning: 21 days');
    assert.equal(v({ species: 'Gerbil', weaningDays: 21 }).value.feedback, 'Gerbil - Weaning: 21 days');
    assert.equal(v({ species: 'Gerbil', gestationDays: 24 }).value.feedback, 'Gerbil - Gestation: 24 days');
    assert.equal(v({ species: 'x'.repeat(121), gestationDays: 5 }).error, 'Species name is too long.');
});
