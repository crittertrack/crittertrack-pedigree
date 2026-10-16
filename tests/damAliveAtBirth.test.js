const test = require('node:test');
const assert = require('node:assert/strict');
const { damDeceasedBeforeBirth, resolveDamCheck } = require('../utils/damAliveAtBirth');

const died = (deceasedDate, birthDate) => damDeceasedBeforeBirth({ damName: 'Luna', damId: 'CTC1', deceasedDate, birthDate });

test('dam who died before the birth date is rejected', () => {
    assert.match(died('2026-03-01', '2026-03-10'), /Luna \(CTC1\) was deceased before the litter's birth date/);
});

test('same-day death, later death, still alive and missing dates are all fine', () => {
    assert.equal(died('2026-03-10', '2026-03-10'), null);
    assert.equal(died('2026-04-01', '2026-03-10'), null);
    assert.equal(died(null, '2026-03-10'), null);
    assert.equal(died('2026-03-01', null), null);
    assert.equal(died('garbage', '2026-03-10'), null);
});

test('timestamps are compared by day, not by time of day', () => {
    assert.equal(died('2026-03-10T23:00:00.000Z', '2026-03-10T00:00:00.000Z'), null);
    assert.ok(died('2026-03-09T23:59:00.000Z', '2026-03-10T00:00:00.000Z'));
});

test('create: checks the dam and birth date in the body', () => {
    assert.deepEqual(resolveDamCheck({ damId_public: 'CTC1', birthDate: '2026-03-10' }), { damId: 'CTC1', birthDate: '2026-03-10' });
    assert.equal(resolveDamCheck({ damId_public: 'CTC1' }), null);
    assert.equal(resolveDamCheck({ birthDate: '2026-03-10' }), null);
});

test('update: only checks when the save sets the birth date or dam, using the stored value for the other', () => {
    const prior = { damId_public: 'CTC1', birthDate: '2026-03-10' };
    assert.equal(resolveDamCheck({ notes: 'x', numberBorn: 4 }, prior), null, 'unrelated edit on an old litter is never blocked');
    assert.deepEqual(resolveDamCheck({ birthDate: '2026-05-01' }, { damId_public: 'CTC1' }), { damId: 'CTC1', birthDate: '2026-05-01' });
    assert.deepEqual(resolveDamCheck({ damId_public: 'CTC2' }, prior), { damId: 'CTC2', birthDate: '2026-03-10' });
    assert.equal(resolveDamCheck({ birthDate: null }, prior), null, 'clearing the birth date is fine');
});

test('unknown birth date is skipped', () => {
    assert.equal(resolveDamCheck({ damId_public: 'CTC1', birthDate: '2026-03-10', birthDateUnknown: true }), null);
    assert.equal(resolveDamCheck({ damId_public: 'CTC2' }, { damId_public: 'CTC1', birthDate: null, birthDateUnknown: true }), null);
});
