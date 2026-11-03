// Pure helpers for year-end financial reports. No DB access; unit-testable.

const COST_TYPES = new Set(['expense', 'purchase']);
const REVENUE_TYPES = new Set(['sale', 'income']);
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

function yearOf(tx) {
    const d = tx && tx.date ? new Date(tx.date) : null;
    return d && !isNaN(d.getTime()) ? d.getUTCFullYear() : null;
}

function summarizeYear(transactions, year) {
    let totalCost = 0, totalRevenue = 0, costCount = 0, saleCount = 0;
    const byMonth = {};
    const costByCategory = {};
    for (const tx of transactions || []) {
        if (year != null && yearOf(tx) !== year) continue;
        const price = Number(tx.price) || 0;
        const m = tx.date ? new Date(tx.date).getUTCMonth() + 1 : 0;
        byMonth[m] = byMonth[m] || { cost: 0, revenue: 0 };
        if (COST_TYPES.has(tx.type)) { totalCost += price; costCount++; byMonth[m].cost += price; const cat = tx.category || (tx.type === 'purchase' ? 'purchase' : 'other'); costByCategory[cat] = round2((costByCategory[cat] || 0) + price); }
        else if (REVENUE_TYPES.has(tx.type)) { totalRevenue += price; if (tx.type === 'sale') saleCount++; byMonth[m].revenue += price; }
    }
    for (const k of Object.keys(byMonth)) { byMonth[k].cost = round2(byMonth[k].cost); byMonth[k].revenue = round2(byMonth[k].revenue); byMonth[k].net = round2(byMonth[k].revenue - byMonth[k].cost); }
    return { year, totalCost: round2(totalCost), totalRevenue: round2(totalRevenue), net: round2(totalRevenue - totalCost), costCount, saleCount, byMonth, costByCategory };
}

function availableYears(transactions) {
    const set = new Set();
    for (const tx of transactions || []) { const y = yearOf(tx); if (y != null) set.add(y); }
    return Array.from(set).sort((a,b) => b - a);
}

module.exports = { COST_TYPES, REVENUE_TYPES, round2, yearOf, summarizeYear, availableYears };
