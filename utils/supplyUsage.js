// Helpers for the "Usage" budget: working out what a use of a supply cost, deducting stock with
// unit conversion, and recording a SupplyUsage entry.
//
// Usage is NOT money paid. Buying a supply already creates a Budget expense (Transaction), so usage
// entries are kept in their own collection and are never added to purchase totals.
// Models are passed in (not required here) so this file can be unit-tested with simple fakes.

const { convertQuantity } = require('./quantityUnits');

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const round4 = (n) => Math.round((Number(n) || 0) * 10000) / 10000;

const httpError = (status, message) => {
    const err = new Error(message);
    err.status = status;
    return err;
};

// Cost of using `quantity` (already in the supply's stock unit) at `costPerUnit`.
// A supply with no price gives priced:false so the UI can warn that costs are understated.
function computeUsageCost(quantity, costPerUnit) {
    const q = Number(quantity);
    const price = costPerUnit === null || costPerUnit === undefined || costPerUnit === '' ? null : Number(costPerUnit);
    if (!Number.isFinite(q) || q <= 0 || price === null || !Number.isFinite(price) || price < 0) {
        return { unitCost: null, cost: 0, priced: false };
    }
    return { unitCost: price, cost: round4(q * price), priced: true };
}

// Convert an entered quantity+unit into the supply's stock unit.
// Mirrors the animal feeding route: a supply with no unit yet adopts the entered unit.
function resolveStockQuantity(supply, quantity, unit) {
    const entered = Number(quantity);
    if (!Number.isFinite(entered) || entered <= 0) {
        throw httpError(400, 'Quantity must be a positive number.');
    }
    const stockUnit = supply.unit || unit || '';
    const adoptUnit = !supply.unit && unit ? unit : null;
    const inStockUnit = unit ? convertQuantity(entered, unit, stockUnit) : entered;
    if (inStockUnit === null || inStockUnit === undefined) {
        throw httpError(400, `Cannot convert ${unit} to the inventory unit ${supply.unit}. Choose compatible units.`);
    }
    return { quantityInStockUnit: inStockUnit, stockUnit, adoptUnit };
}

// Save a usage entry. Never throws: failing to record cost must not break feeding or stock changes.
async function recordSupplyUsage(SupplyUsage, { userId, supply, quantityInStockUnit, source, animalId, litterId, enclosureId, note, date }) {
    try {
        const { unitCost, cost, priced } = computeUsageCost(quantityInStockUnit, supply.costPerUnit);
        return await SupplyUsage.create({
            userId,
            supplyId: supply._id || null,
            supplyName: supply.name || '',
            supplyCategory: supply.category || 'Other',
            quantity: round4(quantityInStockUnit),
            unit: supply.unit || '',
            unitCost,
            cost,
            priced,
            date: date || new Date(),
            source: source || 'other',
            animalId: animalId || null,
            litterId: litterId || null,
            enclosureId: enclosureId ? String(enclosureId) : null,
            note: note || '',
        });
    } catch (err) {
        console.warn('[supplyUsage] Failed to record usage entry:', err && err.message ? err.message : err);
        return null;
    }
}

// Deduct stock (never below zero) and record the usage. Throws {status} errors for bad input.
async function applySupplyUsage({ SupplyItem, SupplyUsage, userId, supplyId, quantity, unit, source, animalId, litterId, enclosureId, note, date }) {
    if (!supplyId) throw httpError(400, 'supplyId is required.');
    const supply = await SupplyItem.findOne({ _id: supplyId, userId });
    if (!supply) throw httpError(404, 'Supply item not found.');

    const { quantityInStockUnit, adoptUnit } = resolveStockQuantity(supply, quantity, unit);
    if (adoptUnit) supply.unit = adoptUnit;
    supply.currentStock = Math.max(0, (supply.currentStock || 0) - quantityInStockUnit);
    await supply.save();

    const usage = await recordSupplyUsage(SupplyUsage, {
        userId, supply, quantityInStockUnit, source, animalId, litterId, enclosureId, note, date,
    });
    return { supply, usage };
}

// Totals for a list of usage entries, plus a per-supply breakdown and which supplies had no price.
function summarizeUsage(entries) {
    const seen = new Set();
    let totalCost = 0;
    let count = 0;
    let unpricedCount = 0;
    const bySupply = new Map();
    const unpricedNames = new Set();

    for (const entry of entries || []) {
        const key = entry && entry._id ? String(entry._id) : null;
        if (key) {
            if (seen.has(key)) continue;
            seen.add(key);
        }
        count++;
        totalCost += Number(entry.cost) || 0;
        const name = entry.supplyName || 'Unknown supply';
        if (!entry.priced) {
            unpricedCount++;
            unpricedNames.add(name);
        }
        const groupKey = `${entry.supplyId || name}|${entry.unit || ''}`;
        const group = bySupply.get(groupKey) || { supplyName: name, unit: entry.unit || '', quantity: 0, cost: 0 };
        group.quantity += Number(entry.quantity) || 0;
        group.cost += Number(entry.cost) || 0;
        bySupply.set(groupKey, group);
    }

    return {
        totalCost: round2(totalCost),
        count,
        unpricedCount,
        unpricedSupplies: [...unpricedNames].sort(),
        bySupply: [...bySupply.values()]
            .map(g => ({ ...g, quantity: round4(g.quantity), cost: round2(g.cost) }))
            .sort((a, b) => b.cost - a.cost || a.supplyName.localeCompare(b.supplyName)),
    };
}

module.exports = {
    computeUsageCost,
    resolveStockQuantity,
    recordSupplyUsage,
    applySupplyUsage,
    summarizeUsage,
};
