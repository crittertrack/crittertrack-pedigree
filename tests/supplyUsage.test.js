const test = require('node:test');
const assert = require('node:assert/strict');
const {
    computeUsageCost,
    resolveStockQuantity,
    recordSupplyUsage,
    applySupplyUsage,
    summarizeUsage,
} = require('../utils/supplyUsage');

// Minimal fakes standing in for the Mongoose models.
const makeSupply = (over = {}) => {
    const supply = {
        _id: 's1', name: 'Mash', category: 'Food', unit: 'kg', currentStock: 2, costPerUnit: 10,
        saved: 0, async save() { this.saved++; },
        ...over,
    };
    return supply;
};
const fakeSupplyItem = (supply) => ({ findOne: async ({ _id }) => (supply && _id === supply._id ? supply : null) });
const fakeUsage = () => {
    const created = [];
    return { created, create: async (doc) => { created.push(doc); return { _id: `u${created.length}`, ...doc }; } };
};

test('computes cost from quantity and price, flags unpriced supplies', () => {
    assert.deepEqual(computeUsageCost(0.05, 10), { unitCost: 10, cost: 0.5, priced: true });
    assert.deepEqual(computeUsageCost(2, 0), { unitCost: 0, cost: 0, priced: true });
    assert.deepEqual(computeUsageCost(2, null), { unitCost: null, cost: 0, priced: false });
    assert.deepEqual(computeUsageCost(0, 10), { unitCost: null, cost: 0, priced: false });
    assert.deepEqual(computeUsageCost(1, -5), { unitCost: null, cost: 0, priced: false });
});

test('converts entered units into the stock unit (50 g of a kg supply is 0.05 kg, not 50)', () => {
    const r = resolveStockQuantity({ unit: 'kg' }, 50, 'g');
    assert.equal(r.quantityInStockUnit, 0.05);
    assert.equal(r.adoptUnit, null);
});

test('rejects incompatible units and bad quantities', () => {
    assert.throws(() => resolveStockQuantity({ unit: 'kg' }, 5, 'ml'), (e) => e.status === 400 && /Cannot convert/.test(e.message));
    assert.throws(() => resolveStockQuantity({ unit: 'kg' }, 0, 'g'), (e) => e.status === 400);
    assert.throws(() => resolveStockQuantity({ unit: 'kg' }, 'abc', 'g'), (e) => e.status === 400);
});

test('a supply without a unit adopts the entered unit', () => {
    const r = resolveStockQuantity({ unit: '' }, 3, 'scoop');
    assert.equal(r.quantityInStockUnit, 3);
    assert.equal(r.adoptUnit, 'scoop');
});

test('applying usage deducts converted stock, never below zero, and records cost', async () => {
    const supply = makeSupply({ currentStock: 0.04 });
    const Usage = fakeUsage();
    const { usage } = await applySupplyUsage({
        SupplyItem: fakeSupplyItem(supply), SupplyUsage: Usage, userId: 'u',
        supplyId: 's1', quantity: 50, unit: 'g', source: 'litter', litterId: 'CTL1',
    });
    assert.equal(supply.currentStock, 0);
    assert.equal(supply.saved, 1);
    assert.equal(usage.quantity, 0.05);
    assert.equal(usage.cost, 0.5);
    assert.equal(usage.priced, true);
    assert.equal(usage.litterId, 'CTL1');
    assert.equal(usage.source, 'litter');
});

test('applying usage to a missing supply is a 404 and records nothing', async () => {
    const Usage = fakeUsage();
    await assert.rejects(
        applySupplyUsage({ SupplyItem: fakeSupplyItem(null), SupplyUsage: Usage, userId: 'u', supplyId: 'nope', quantity: 1, unit: 'kg' }),
        (e) => e.status === 404,
    );
    assert.equal(Usage.created.length, 0);
});

test('bad units leave stock untouched', async () => {
    const supply = makeSupply();
    const Usage = fakeUsage();
    await assert.rejects(
        applySupplyUsage({ SupplyItem: fakeSupplyItem(supply), SupplyUsage: Usage, userId: 'u', supplyId: 's1', quantity: 5, unit: 'ml' }),
        (e) => e.status === 400,
    );
    assert.equal(supply.currentStock, 2);
    assert.equal(supply.saved, 0);
    assert.equal(Usage.created.length, 0);
});

test('recording usage never throws, even if saving fails', async () => {
    const failing = { create: async () => { throw new Error('db down'); } };
    const result = await recordSupplyUsage(failing, { userId: 'u', supply: makeSupply(), quantityInStockUnit: 1, source: 'feeding' });
    assert.equal(result, null);
});

test('unpriced supply is recorded as a $0 entry marked unpriced', async () => {
    const Usage = fakeUsage();
    await recordSupplyUsage(Usage, { userId: 'u', supply: makeSupply({ costPerUnit: null }), quantityInStockUnit: 2, source: 'feeding', animalId: 'CTC1' });
    assert.equal(Usage.created[0].cost, 0);
    assert.equal(Usage.created[0].priced, false);
    assert.equal(Usage.created[0].animalId, 'CTC1');
});

test('summarizes totals per supply and lists unpriced supplies', () => {
    const s = summarizeUsage([
        { _id: '1', supplyId: 'a', supplyName: 'Mash', unit: 'kg', quantity: 0.05, cost: 0.5, priced: true },
        { _id: '2', supplyId: 'a', supplyName: 'Mash', unit: 'kg', quantity: 0.1, cost: 1, priced: true },
        { _id: '3', supplyId: 'b', supplyName: 'Pellets', unit: 'g', quantity: 20, cost: 0, priced: false },
        { _id: '3', supplyId: 'b', supplyName: 'Pellets', unit: 'g', quantity: 20, cost: 0, priced: false },
    ]);
    assert.equal(s.totalCost, 1.5);
    assert.equal(s.count, 3);
    assert.equal(s.unpricedCount, 1);
    assert.deepEqual(s.unpricedSupplies, ['Pellets']);
    assert.deepEqual(s.bySupply[0], { supplyName: 'Mash', unit: 'kg', quantity: 0.15, cost: 1.5 });
});
