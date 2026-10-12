const UNIT_DEFINITIONS = {
    mcg: { family: 'mass', factor: 0.000001 },
    mg: { family: 'mass', factor: 0.001 },
    g: { family: 'mass', factor: 1 },
    kg: { family: 'mass', factor: 1000 },
    oz: { family: 'mass', factor: 28.349523125 },
    lb: { family: 'mass', factor: 453.59237 },
    ml: { family: 'volume', factor: 1 },
    l: { family: 'volume', factor: 1000 },
    tsp: { family: 'volume', factor: 4.92892159375 },
    tbsp: { family: 'volume', factor: 14.78676478125 },
    cup: { family: 'volume', factor: 236.5882365 },
    each: { family: 'count', factor: 1 },
    piece: { family: 'count', factor: 1 },
    item: { family: 'count', factor: 1 },
};

const UNIT_ALIASES = {
    microgram: 'mcg', micrograms: 'mcg', μg: 'mcg', ug: 'mcg',
    milligram: 'mg', milligrams: 'mg',
    gram: 'g', grams: 'g',
    kilogram: 'kg', kilograms: 'kg',
    ounce: 'oz', ounces: 'oz',
    pound: 'lb', pounds: 'lb', lbs: 'lb',
    milliliter: 'ml', milliliters: 'ml', millilitre: 'ml', millilitres: 'ml',
    liter: 'l', liters: 'l', litre: 'l', litres: 'l',
    teaspoon: 'tsp', teaspoons: 'tsp',
    tablespoon: 'tbsp', tablespoons: 'tbsp',
    cups: 'cup',
    ea: 'each', pcs: 'piece', pieces: 'piece', units: 'each',
    items: 'item',
};

const normalizeUnit = (unit) => {
    const normalized = String(unit || '').trim().toLowerCase();
    const alias = UNIT_ALIASES[normalized] || normalized;
    return UNIT_DEFINITIONS[alias] ? alias : null;
};

const convertQuantity = (quantity, fromUnit, toUnit) => {
    const amount = Number(quantity);
    if (!Number.isFinite(amount)) return null;

    const from = normalizeUnit(fromUnit);
    const to = normalizeUnit(toUnit);
    if (!from || !to) {
        return String(fromUnit || '').trim().toLowerCase() === String(toUnit || '').trim().toLowerCase()
            ? amount
            : null;
    }
    if (UNIT_DEFINITIONS[from].family !== UNIT_DEFINITIONS[to].family) return null;
    return amount * UNIT_DEFINITIONS[from].factor / UNIT_DEFINITIONS[to].factor;
};

module.exports = { convertQuantity };
