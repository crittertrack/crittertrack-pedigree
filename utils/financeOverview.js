// Pure helpers for the per-animal and per-litter finance overviews. No database access here
// so the maths can be unit-tested directly (see tests/financeOverview.test.js).
//
// Rules (agreed with the user):
//  - Costs  = 'expense' and 'purchase' transactions.
//  - Revenue = 'sale' and 'income' transactions.
//  - A litter overview counts costs tagged to the litter plus costs on its individual offspring.
//    Parent (sire/dam) costs are never included.
//  - Litters are never sold as a unit; revenue comes only from individual offspring sales.
//  - Kept offspring are shown as "kept, no revenue" with no estimated value.
//  - Reserved offspring contribute "expected revenue" (reservedPrice) until they are sold.

const COST_TYPES = new Set(['expense', 'purchase']);
const REVENUE_TYPES = new Set(['sale', 'income']);

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

const toNumber = (n) => {
    const v = Number(n);
    return Number.isFinite(v) ? v : 0;
};

// Totals for a list of transactions, plus a per-category cost breakdown.
function summarizeTransactions(transactions) {
    const seen = new Set();
    let totalCost = 0;
    let totalRevenue = 0;
    let costCount = 0;
    let saleCount = 0;
    const costByCategory = {};

    for (const tx of transactions || []) {
        // Guard against the same transaction arriving twice (e.g. matched by litter AND animal).
        const key = tx && tx._id ? String(tx._id) : null;
        if (key) {
            if (seen.has(key)) continue;
            seen.add(key);
        }
        const price = toNumber(tx.price);
        if (COST_TYPES.has(tx.type)) {
            totalCost += price;
            costCount++;
            const cat = tx.category || (tx.type === 'purchase' ? 'purchase' : 'other');
            costByCategory[cat] = round2((costByCategory[cat] || 0) + price);
        } else if (REVENUE_TYPES.has(tx.type)) {
            totalRevenue += price;
            if (tx.type === 'sale') saleCount++;
        }
    }

    return {
        totalCost: round2(totalCost),
        totalRevenue: round2(totalRevenue),
        net: round2(totalRevenue - totalCost),
        costCount,
        saleCount,
        costByCategory,
    };
}

// Share of costs already paid back by revenue, as a whole percentage. null when there are no costs.
function costRecoupedPercent(totalCost, totalRevenue) {
    if (!(totalCost > 0)) return null;
    return Math.round((totalRevenue / totalCost) * 100);
}

// Which bucket an offspring falls into for the litter overview.
// Order matters: sold > deceased > reserved > available > kept.
function classifyOffspring(animal) {
    if (!animal) return 'kept';
    if (animal.soldStatus === 'sold' || animal.saleDate) return 'sold';
    if (animal.deceasedDate) return 'deceased';
    if (animal.status === 'Culled') return 'cull';
    if (animal.reservedBuyerName || animal.reservedWaitlistEntryId || toNumber(animal.reservedPrice) > 0) return 'booked';
    if (animal.isForSale) return 'available';
    return 'kept';
}

function buildAnimalOverview({ animal, transactions }) {
    const summary = summarizeTransactions(transactions);
    const reserved = animal && classifyOffspring(animal) === 'booked';
    const expectedRevenue = reserved ? round2(animal.reservedPrice) : 0;
    const deposit = reserved ? round2(animal.reservedDeposit) : 0;

    return {
        animalId: animal ? animal.id_public : null,
        animalName: animal ? animal.name : null,
        ...summary,
        expectedRevenue,
        reservedDeposit: deposit,
        status: animal ? classifyOffspring(animal) : null,
    };
}

function buildLitterOverview({ litter, offspring, transactions }) {
    const summary = summarizeTransactions(transactions);

    // Deposits already paid on booked animals count as earned revenue.
    let depositEarned = 0;
    for (const animal of offspring || []) {
        if (classifyOffspring(animal) === 'booked' && animal.reservedDepositStatus === 'done') {
            depositEarned += toNumber(animal.reservedDeposit);
        }
    }
    summary.totalRevenue = round2(summary.totalRevenue + depositEarned);
    summary.net = round2(summary.totalRevenue - summary.totalCost);

    const counts = { sold: 0, booked: 0, available: 0, kept: 0, deceased: 0, cull: 0 };
    let expectedRevenue = 0;
    let reservedDeposit = 0;
    const offspringDetails = [];
    for (const animal of offspring || []) {
        const bucket = classifyOffspring(animal);
        counts[bucket]++;
        let amount = null;
        let deposit = null;
        if (bucket === 'booked' || bucket === 'available' || bucket === 'sold') {
            amount = round2(animal.reservedPrice);
            if (bucket === 'booked') {
                deposit = round2(animal.reservedDeposit);
                expectedRevenue += toNumber(animal.reservedPrice);
                reservedDeposit += toNumber(animal.reservedDeposit);
            }
        }
        offspringDetails.push({ name: animal ? (animal.name || animal.id_public) : null, displayName: animal ? (animal.prefix || '') + (animal.name || '') + (animal.suffix || '') : null, id: animal ? animal.id_public : null, status: bucket, amount, deposit });
    }

    const offspringCount = (offspring || []).length;
    const born = toNumber(litter && (litter.litterSizeBorn ?? litter.numberBorn)) || offspringCount;
    const costPerOffspringBorn = born > 0 && summary.totalCost > 0 ? round2(summary.totalCost / born) : null;

    return {
        litterId: litter ? litter.litter_id_public : null,
        ...summary,
        costRecoupedPercent: costRecoupedPercent(summary.totalCost, summary.totalRevenue),
        breakEvenRemaining: round2(Math.max(0, summary.totalCost - summary.totalRevenue)),
        expectedRevenue: round2(expectedRevenue),
        reservedDeposit: round2(reservedDeposit),
        offspringCount,
        bornCount: born,
        costPerOffspringBorn,
        offspring: counts,
        offspringDetails,
    };
}

module.exports = {
    COST_TYPES,
    REVENUE_TYPES,
    summarizeTransactions,
    costRecoupedPercent,
    classifyOffspring,
    buildAnimalOverview,
    buildLitterOverview,
};
