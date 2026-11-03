const test = require('node:test');
const assert = require('node:assert/strict');
const { summarizeYear, availableYears } = require('../utils/yearEndReport');

const txns = [
    { type: 'sale', price: 100, date: '2025-03-15', category: null },
    { type: 'expense', price: 30, date: '2025-03-20', category: 'food' },
    { type: 'sale', price: 50, date: '2024-12-01', category: null },
];

test('summarizeYear filters by year and aggregates', () => {
    const s = summarizeYear(txns, 2025);
    assert.equal(s.totalRevenue, 100);
    assert.equal(s.totalCost, 30);
    assert.equal(s.net, 70);
    assert.equal(s.saleCount, 1);
    assert.equal(s.costCount, 1);
});

test('availableYears returns sorted unique years', () => {
    assert.deepEqual(availableYears(txns), [2025, 2024]);
});
