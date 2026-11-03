const test = require('node:test');
const assert = require('node:assert/strict');
const {
    summarizeTransactions,
    costRecoupedPercent,
    classifyOffspring,
    buildAnimalOverview,
    buildLitterOverview,
} = require('../utils/financeOverview');

test('summarizes costs and revenue and ignores gifts', () => {
    const s = summarizeTransactions([
        { _id: '1', type: 'expense', price: 40, category: 'vet' },
        { _id: '2', type: 'expense', price: 12.5, category: 'food' },
        { _id: '3', type: 'purchase', price: 100 },
        { _id: '4', type: 'sale', price: 60 },
        { _id: '5', type: 'gift', price: 999 },
    ]);
    assert.equal(s.totalCost, 152.5);
    assert.equal(s.totalRevenue, 60);
    assert.equal(s.net, -92.5);
    assert.equal(s.saleCount, 1);
    assert.deepEqual(s.costByCategory, { vet: 40, food: 12.5, purchase: 100 });
});

test('does not double count a transaction that appears twice', () => {
    const s = summarizeTransactions([
        { _id: 'a', type: 'expense', price: 10 },
        { _id: 'a', type: 'expense', price: 10 },
    ]);
    assert.equal(s.totalCost, 10);
});

test('cost recouped percent handles zero costs', () => {
    assert.equal(costRecoupedPercent(0, 50), null);
    assert.equal(costRecoupedPercent(200, 50), 25);
});

test('classifies offspring: sold, deceased, reserved, available, kept', () => {
    assert.equal(classifyOffspring({ soldStatus: 'sold' }), 'sold');
    assert.equal(classifyOffspring({ saleDate: new Date() }), 'sold');
    assert.equal(classifyOffspring({ deceasedDate: new Date() }), 'deceased');
    assert.equal(classifyOffspring({ reservedBuyerName: 'Sam' }), 'reserved');
    assert.equal(classifyOffspring({ reservedPrice: 50 }), 'reserved');
    assert.equal(classifyOffspring({ isForSale: true }), 'available');
    assert.equal(classifyOffspring({}), 'kept');
    // A sold animal that is also flagged deceased still counts as sold.
    assert.equal(classifyOffspring({ saleDate: new Date(), deceasedDate: new Date() }), 'sold');
});

test('litter overview: kept offspring give no revenue, reserved give expected revenue', () => {
    const overview = buildLitterOverview({
        litter: { litter_id_public: 'CTL1', litterSizeBorn: 8 },
        offspring: [
            { id_public: 'A', soldStatus: 'sold' },
            { id_public: 'B', reservedBuyerName: 'Sam', reservedPrice: 50, reservedDeposit: 10 },
            { id_public: 'C' },
            { id_public: 'D' },
            { id_public: 'E', isForSale: true },
            { id_public: 'F', deceasedDate: new Date() },
        ],
        transactions: [
            { _id: '1', type: 'expense', price: 80, category: 'vet' },
            { _id: '2', type: 'expense', price: 40, category: 'food' },
            { _id: '3', type: 'sale', price: 60 },
        ],
    });
    assert.equal(overview.totalCost, 120);
    assert.equal(overview.totalRevenue, 60);
    assert.equal(overview.costRecoupedPercent, 50);
    assert.equal(overview.breakEvenRemaining, 60);
    assert.equal(overview.expectedRevenue, 50);
    assert.equal(overview.reservedDeposit, 10);
    assert.equal(overview.costPerOffspringBorn, 15);
    assert.deepEqual(overview.offspring, { sold: 1, reserved: 1, available: 1, kept: 2, deceased: 1 });
});

test('litter overview falls back to offspring count when litter size is unknown', () => {
    const overview = buildLitterOverview({
        litter: { litter_id_public: 'CTL2' },
        offspring: [{ id_public: 'A' }, { id_public: 'B' }],
        transactions: [{ _id: '1', type: 'expense', price: 30 }],
    });
    assert.equal(overview.bornCount, 2);
    assert.equal(overview.costPerOffspringBorn, 15);
});

test('litter overview with no costs has null percentage and cost per offspring', () => {
    const overview = buildLitterOverview({ litter: { litter_id_public: 'CTL3' }, offspring: [], transactions: [] });
    assert.equal(overview.costRecoupedPercent, null);
    assert.equal(overview.costPerOffspringBorn, null);
});

test('animal overview reports expected revenue only while reserved', () => {
    const reserved = buildAnimalOverview({
        animal: { id_public: 'A', name: 'Milo', reservedPrice: 75, reservedDeposit: 20, reservedBuyerName: 'Sam' },
        transactions: [{ _id: '1', type: 'expense', price: 10 }],
    });
    assert.equal(reserved.expectedRevenue, 75);
    assert.equal(reserved.reservedDeposit, 20);
    assert.equal(reserved.status, 'reserved');

    const sold = buildAnimalOverview({
        animal: { id_public: 'A', name: 'Milo', soldStatus: 'sold', reservedPrice: 75 },
        transactions: [{ _id: '2', type: 'sale', price: 75 }],
    });
    assert.equal(sold.expectedRevenue, 0);
    assert.equal(sold.totalRevenue, 75);
});
