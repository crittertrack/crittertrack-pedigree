const test = require('node:test');
const assert = require('node:assert/strict');
const { convertQuantity } = require('../utils/quantityUnits');

test('converts mass and volume quantities into inventory units', () => {
    assert.equal(convertQuantity(100, 'g', 'kg'), 0.1);
    assert.equal(convertQuantity(1, 'mg', 'g'), 0.001);
    assert.equal(convertQuantity(2, 'l', 'ml'), 2000);
});

test('rejects incompatible units while retaining exact custom units', () => {
    assert.equal(convertQuantity(1, 'ml', 'g'), null);
    assert.equal(convertQuantity(1, 'scoop', 'kg'), null);
    assert.equal(convertQuantity(1, 'scoop', 'scoop'), 1);
});
