const test = require('node:test');
const assert = require('node:assert/strict');
const { sanitizeTemplateTasks, mergeTemplateTasks } = require('../utils/careTemplates');

test('sanitizeTemplateTasks trims, validates and normalizes tasks', () => {
    const { tasks, error } = sanitizeTemplateTasks([
        { taskName: '  Mist enclosure ', frequencyDays: '1', notes: ' morning ' },
        { taskName: 'UVB bulb check', frequencyDays: null },
        { taskName: 'Weigh-in', frequencyDays: '' },
    ]);
    assert.equal(error, undefined);
    assert.deepEqual(tasks, [
        { taskName: 'Mist enclosure', frequencyDays: 1, notes: 'morning' },
        { taskName: 'UVB bulb check', frequencyDays: null, notes: null },
        { taskName: 'Weigh-in', frequencyDays: null, notes: null },
    ]);
});

test('sanitizeTemplateTasks rejects bad input', () => {
    assert.match(sanitizeTemplateTasks('nope').error, /array/);
    assert.match(sanitizeTemplateTasks([{ taskName: '  ' }]).error, /name/);
    assert.match(sanitizeTemplateTasks([{ taskName: 'A', frequencyDays: 0 }]).error, /frequency/);
    assert.match(sanitizeTemplateTasks([{ taskName: 'A', frequencyDays: 1.5 }]).error, /frequency/);
    assert.match(sanitizeTemplateTasks([{ taskName: 'A', frequencyDays: 99999 }]).error, /frequency/);
    assert.match(sanitizeTemplateTasks([{ taskName: 'Clean' }, { taskName: ' clean ' }]).error, /Duplicate/);
    assert.match(sanitizeTemplateTasks(new Array(51).fill(0).map((_, i) => ({ taskName: `t${i}` }))).error, /at most/);
    assert.match(sanitizeTemplateTasks([{ taskName: 'x'.repeat(81) }]).error, /characters/);
});

test('mergeTemplateTasks copies new tasks and skips ones the animal already has', () => {
    let n = 0;
    const makeId = () => `id${++n}`;
    const existing = [{ taskName: 'nail trim', frequencyDays: 14, lastDoneDate: '2026-01-01' }];
    const template = [
        { taskName: 'Nail Trim', frequencyDays: 30, notes: null },
        { taskName: 'Weigh-in', frequencyDays: 7, notes: 'before feeding' },
        { taskName: 'Health check', frequencyDays: null, notes: null },
    ];
    const { toAdd, skipped } = mergeTemplateTasks(existing, template, makeId);
    assert.equal(skipped, 1);
    assert.deepEqual(toAdd, [
        { id: 'id1', taskName: 'Weigh-in', notes: 'before feeding', frequencyDays: 7, lastDoneDate: null },
        { id: 'id2', taskName: 'Health check', notes: null, frequencyDays: null, lastDoneDate: null },
    ]);
});

test('mergeTemplateTasks is idempotent when applied twice', () => {
    const template = [{ taskName: 'Weigh-in', frequencyDays: 7 }];
    const first = mergeTemplateTasks([], template);
    const second = mergeTemplateTasks(first.toAdd, template);
    assert.equal(first.toAdd.length, 1);
    assert.equal(second.toAdd.length, 0);
    assert.equal(second.skipped, 1);
});

test('mergeTemplateTasks handles missing inputs', () => {
    assert.deepEqual(mergeTemplateTasks(undefined, undefined), { toAdd: [], skipped: 0 });
});
