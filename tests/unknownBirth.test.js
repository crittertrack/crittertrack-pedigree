const test = require('node:test');
const assert = require('node:assert/strict');
const { normaliseUnknownBirth, isUnknownBirth } = require('../utils/unknownBirth');
const { getLitterReproStatus } = require('../utils/reproStatusSync');

test('flag with no date: stays dateless, not planned, no weaning', () => {
    const p = normaliseUnknownBirth({ birthDateUnknown: true, birthDate: '', isPlanned: true, weaningDate: '2026-11-01', weaningConfirmed: true });
    assert.equal(p.birthDate, null);
    assert.equal(p.birthDateUnknown, true);
    assert.equal(p.isPlanned, false);
    assert.equal(p.weaningDate, null);
    assert.equal(p.weaningConfirmed, false);
});

test('a real birth date always wins and clears the flag', () => {
    const p = normaliseUnknownBirth({ birthDateUnknown: true, birthDate: '2026-09-01' });
    assert.equal(p.birthDate, '2026-09-01');
    assert.equal(p.birthDateUnknown, false);
});

test('payloads without the flag are left alone (e.g. Wean Today patches)', () => {
    const p = normaliseUnknownBirth({ weaningDate: '2026-11-01', weaningConfirmed: true });
    assert.deepEqual(p, { weaningDate: '2026-11-01', weaningConfirmed: true });
    assert.equal(normaliseUnknownBirth(null), null);
});

test('unticking (flag false, no date) does not invent a date or touch other fields', () => {
    const p = normaliseUnknownBirth({ birthDateUnknown: false, birthDate: null, notes: 'x' });
    assert.deepEqual(p, { birthDateUnknown: false, birthDate: null, notes: 'x' });
});

test('isUnknownBirth: payload value wins, else the stored one', () => {
    assert.equal(isUnknownBirth({ birthDateUnknown: true }), true);
    assert.equal(isUnknownBirth({ birthDateUnknown: false }, { birthDateUnknown: true }), false);
    assert.equal(isUnknownBirth({ notes: 'x' }, { birthDateUnknown: true }), true);
    assert.equal(isUnknownBirth({ notes: 'x' }, null), false);
});

test('repro status: an unknown-birth litter never makes the dam nursing, mated or planned', () => {
    const base = { birthDateUnknown: true, birthDate: null, isPlanned: false, matingDate: new Date('2026-09-01') };
    assert.equal(getLitterReproStatus(base, new Date('2026-10-16')), null);
    // a normal mated litter is unaffected
    assert.equal(getLitterReproStatus({ isPlanned: false, matingDate: new Date('2026-09-01') }, new Date('2026-10-16')), 'mating');
    // a real birth date still nurses
    assert.equal(getLitterReproStatus({ birthDate: new Date('2026-10-10') }, new Date('2026-10-16')), 'nursing');
});
