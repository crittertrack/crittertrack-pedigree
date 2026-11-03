const test = require('node:test');
const assert = require('node:assert/strict');
const { totalPaid, balanceDue, paymentStatus, invoiceSummary } = require('../utils/paymentStatus');

test('totalPaid counts deposit only when done plus payments', () => {
    assert.equal(totalPaid(100, 20, 'done', [{ amount: 30 }]), 50);
    assert.equal(totalPaid(100, 20, 'due', [{ amount: 30 }]), 30);
    assert.equal(totalPaid(100, 20, 'done', []), 20);
});

test('totalPaid caps at price', () => {
    assert.equal(totalPaid(100, 20, 'done', [{ amount: 200 }]), 100);
});

test('balanceDue never negative', () => {
    assert.equal(balanceDue(100, 120), 0);
    assert.equal(balanceDue(100, 40), 60);
});

test('paymentStatus transitions', () => {
    assert.equal(paymentStatus(100, 0), 'unpaid');
    assert.equal(paymentStatus(100, 40), 'partial');
    assert.equal(paymentStatus(100, 100), 'paid');
    assert.equal(paymentStatus(0, 0), 'paid');
});

test('invoiceSummary', () => {
    const s = invoiceSummary({ price: 100, reservedDeposit: 20, reservedDepositStatus: 'done' }, [{ amount: 30 }]);
    assert.equal(s.totalPaid, 50);
    assert.equal(s.balanceDue, 50);
    assert.equal(s.status, 'partial');
});
