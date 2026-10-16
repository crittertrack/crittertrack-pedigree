/**
 * Validation for "suggest gestation / weaning values for a species" (Help Center -> moderation panel).
 *
 * Rules: a species name is required, and at least one of gestationDays / weaningDays must be given.
 * Durations are whole days between 1 and MAX_DAYS (long-gestation species, e.g. chinchilla ~105d,
 * are well inside it). An empty / null / undefined duration just means "not provided".
 */
const MAX_DAYS = 1000;

const parseDays = (raw) => {
    if (raw === undefined || raw === null || String(raw).trim() === '') return { provided: false };
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 1 || n > MAX_DAYS) return { provided: true, invalid: true };
    return { provided: true, value: n };
};

/** @returns {{ error: string } | { value: { species: string, gestationDays: number|null, weaningDays: number|null, feedback: string } }} */
const validateSpeciesValueSuggestion = (body = {}) => {
    const species = typeof body.species === 'string' ? body.species.trim() : '';
    if (!species) return { error: 'Please select a species.' };
    if (species.length > 120) return { error: 'Species name is too long.' };

    const g = parseDays(body.gestationDays);
    const w = parseDays(body.weaningDays);
    if (g.invalid) return { error: `Gestation must be a whole number of days between 1 and ${MAX_DAYS}.` };
    if (w.invalid) return { error: `Weaning must be a whole number of days between 1 and ${MAX_DAYS}.` };
    if (!g.provided && !w.provided) return { error: 'Enter gestation days, weaning days, or both.' };

    const gestationDays = g.provided ? g.value : null;
    const weaningDays = w.provided ? w.value : null;
    const parts = [];
    if (gestationDays !== null) parts.push(`Gestation: ${gestationDays} days`);
    if (weaningDays !== null) parts.push(`Weaning: ${weaningDays} days`);
    return { value: { species, gestationDays, weaningDays, feedback: `${species} - ${parts.join(', ')}` } };
};

module.exports = { validateSpeciesValueSuggestion, MAX_DAYS };
