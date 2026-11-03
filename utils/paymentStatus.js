// Pure helpers for invoice/payment status (no DB/network). Unit-tested in tests/paymentStatus.test.js.

function round2(n) { return Math.round((Number(n) || 0) * 100) / 100; }

// Total paid = deposit paid (if status 'done') + sum of recorded payments.
function totalPaid(price, deposit, depositStatus, payments = []) {
    let paid = 0;
    if (depositStatus === 'done' && deposit) paid += Number(deposit) || 0;
    for (const p of payments || []) paid += Number(p.amount) || 0;
    if (paid > (Number(price) || 0)) paid = Number(price) || 0;
    return round2(paid);
}

function balanceDue(price, paid) {
    return round2(Math.max(0, (Number(price) || 0) - (Number(paid) || 0)));
}

function paymentStatus(price, paid) {
    const p = Number(price) || 0;
    const pd = Number(paid) || 0;
    if (p <= 0) return 'paid';
    if (pd <= 0) return 'unpaid';
    if (pd >= p) return 'paid';
    return 'partial';
}

function invoiceSummary(transaction, payments = []) {
    const price = Number(transaction.price) || 0;
    const deposit = transaction.reservedDeposit ?? null;
    const depositStatus = transaction.reservedDepositStatus ?? null;
    const paid = totalPaid(price, deposit, depositStatus, payments);
    return {
        price: round2(price),
        deposit: deposit == null ? null : round2(deposit),
        depositStatus,
        payments: payments || [],
        totalPaid: paid,
        balanceDue: balanceDue(price, paid),
        status: paymentStatus(price, paid),
    };
}

module.exports = { round2, totalPaid, balanceDue, paymentStatus, invoiceSummary };
