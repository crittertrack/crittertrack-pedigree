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
    assert.equal(classifyOffspring({ reservedBuyerName: 'Sam' }), 'booked');
    // A price alone never changes the status; the animal's own status decides.
    assert.equal(classifyOffspring({ reservedPrice: 50 }), 'kept');
    assert.equal(classifyOffspring({ status: 'Available', reservedPrice: 50, isForSale: false }), 'available');
    assert.equal(classifyOffspring({ status: 'Booked' }), 'booked');
    assert.equal(classifyOffspring({ status: 'Booked', isForSale: true }), 'booked');
    assert.equal(classifyOffspring({ status: 'Pet', reservedBuyerName: 'Sam' }), 'kept');
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
    assert.deepEqual(overview.offspring, { sold: 1, booked: 1, available: 1, kept: 2, deceased: 1, cull: 0 });
});

test('classifies a culled animal, and deceased still wins over culled', () => {
    assert.equal(classifyOffspring({ status: 'Culled' }), 'cull');
    assert.equal(classifyOffspring({ status: 'Culled', deceasedDate: new Date() }), 'deceased');
    // Retired is not the same as culled.
    assert.equal(classifyOffspring({ status: 'Retired' }), 'kept');
});

test('litter table rows: names with prefix/suffix, prices only where they apply', () => {
    const overview = buildLitterOverview({
        litter: { litter_id_public: 'CTL5', litterSizeBorn: 5 },
        offspring: [
            { id_public: 'A', prefix: 'Sir', name: 'Milo', suffix: 'Jr', isForSale: true, salePriceAmount: 40 },
            { id_public: 'B', name: 'Nala', reservedBuyerName: 'Sam', reservedPrice: 50, reservedDeposit: 10, reservedDepositStatus: 'done' },
            { id_public: 'C', name: 'Rex', soldStatus: 'sold', salePrice: 60, reservedPrice: 50 },
            { id_public: 'D', name: 'Kept', salePriceAmount: 99 },
            { id_public: 'E', name: 'Gone', deceasedDate: new Date(), reservedPrice: 99 },
            { id_public: 'F', name: 'Culled', status: 'Culled', reservedPrice: 99 },
        ],
        transactions: [],
    });
    const row = (id) => overview.offspringDetails.find(o => o.id === id);
    assert.equal(row('A').displayName, 'Sir Milo Jr');
    assert.equal(row('A').status, 'available');
    assert.equal(row('A').amount, 40);
    assert.equal(row('B').status, 'booked');
    assert.equal(row('B').amount, 50);
    assert.equal(row('B').deposit, 10);
    assert.equal(row('C').status, 'sold');
    assert.equal(row('C').amount, 60);
    for (const id of ['D', 'E', 'F']) {
        assert.equal(row(id).amount, null, `${id} should have no price`);
        assert.equal(row(id).deposit, null);
    }
    assert.equal(row('F').status, 'cull');
});

test('badge flags: paid = true, still due = false, not applicable = null', () => {
    const overview = buildLitterOverview({
        litter: { litter_id_public: 'CTL7' },
        offspring: [
            { id_public: 'A', reservedBuyerName: 'Sam', reservedPrice: 50, reservedDeposit: 10, reservedDepositStatus: 'done' },
            { id_public: 'B', reservedBuyerName: 'Kim', reservedPrice: 50, reservedDeposit: 10, reservedDepositStatus: 'due' },
            { id_public: 'C', reservedBuyerName: 'Lee', reservedPrice: 50, reservedPaymentStatus: 'done' },
            { id_public: 'D', soldStatus: 'sold', salePrice: 70 },
            { id_public: 'E', isForSale: true, salePriceAmount: 30 },
            { id_public: 'F' },
        ],
        transactions: [],
    });
    const row = (id) => overview.offspringDetails.find(o => o.id === id);
    assert.deepEqual([row('A').depositPaid, row('A').amountPaid], [true, false]);
    assert.deepEqual([row('B').depositPaid, row('B').amountPaid], [false, false]);
    // Booked with no deposit: deposit badge is not applicable, balance paid in full.
    assert.deepEqual([row('C').deposit, row('C').depositPaid, row('C').amountPaid], [null, null, true]);
    assert.deepEqual([row('D').amount, row('D').amountPaid], [70, true]);
    assert.deepEqual([row('E').amount, row('E').amountPaid], [30, null]);
    assert.deepEqual([row('F').amount, row('F').amountPaid, row('F').depositPaid], [null, null, null]);
});

test('a paid deposit on a booked animal counts as earned; an unpaid one does not', () => {
    const paid = buildLitterOverview({
        litter: { litter_id_public: 'CTL6' },
        offspring: [{ id_public: 'A', reservedBuyerName: 'Sam', reservedPrice: 50, reservedDeposit: 10, reservedDepositStatus: 'done' }],
        transactions: [{ _id: '1', type: 'expense', price: 40 }],
    });
    assert.equal(paid.totalRevenue, 10);
    assert.equal(paid.net, -30);
    assert.equal(paid.costRecoupedPercent, 25);

    const due = buildLitterOverview({
        litter: { litter_id_public: 'CTL6' },
        offspring: [{ id_public: 'A', reservedBuyerName: 'Sam', reservedPrice: 50, reservedDeposit: 10, reservedDepositStatus: 'due' }],
        transactions: [],
    });
    assert.equal(due.totalRevenue, 0);
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
    assert.equal(reserved.status, 'booked');

    const sold = buildAnimalOverview({
        animal: { id_public: 'A', name: 'Milo', soldStatus: 'sold', reservedPrice: 75 },
        transactions: [{ _id: '2', type: 'sale', price: 75 }],
    });
    assert.equal(sold.expectedRevenue, 0);
    assert.equal(sold.totalRevenue, 75);
});

