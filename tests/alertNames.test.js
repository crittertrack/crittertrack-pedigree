const test = require('node:test');
const assert = require('node:assert/strict');
const { formatAnimalName, formatAlertNames, formatAlertDigest } = require('../utils/alertNames');

test('formats animal names with their prefix and suffix', () => {
    assert.equal(formatAnimalName({ prefix: 'CH', name: 'Mabel', suffix: 'II' }), 'CH Mabel II');
});

test('formats unique alert names and caps long push summaries', () => {
    assert.equal(formatAlertNames(['Mabel', 'Mabel', 'Pip', 'Nori', 'Bean']), 'Mabel, Pip, Nori, +1 more');
    assert.equal(formatAlertNames(['M'.repeat(80)]), `${'M'.repeat(57)}...`);
});

test('includes named animals in the push digest and retains a useful nameless fallback', () => {
    assert.equal(formatAlertDigest(2, ['Mabel', 'Pip']), '2 items due: Mabel, Pip. Tap to review.');
    assert.equal(formatAlertDigest(1, []), '1 item due. Tap to review.');
});
