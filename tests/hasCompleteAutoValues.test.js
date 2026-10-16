const test = require('node:test');
const assert = require('node:assert/strict');
const { hasCompleteAutoValues } = require('../utils/autoWeaningDate');

test('species with both a gestation and a weaning rule are covered', () => {
    for (const s of ['Fancy Rat', 'Fancy Mouse', 'Syrian Hamster', 'Guinea Pig']) {
        assert.equal(hasCompleteAutoValues(s), true, s);
    }
});

test('species without rules (deliberately excluded or unknown) stay open for suggestions', () => {
    for (const s of ['Sugar Glider', 'Whitetail Antsangy', 'Ball Python', 'Totally Made Up', '', null, undefined]) {
        assert.equal(hasCompleteAutoValues(s), false, String(s));
    }
});
