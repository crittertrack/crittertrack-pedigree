/**
 * Auto litter-date rules — FOR USERS CTU2, CTU5, CTU107 AND CTU80 ONLY. (Historic filename: the module also
 * auto-fills expectedDueDate, hence both rule sets living here.)
 *
 * 1) weaningDate = birthDate + the SPECIES' WEANING AGE:
 *      Fancy Mouse 31 · Fancy Rat 35 · Syrian Hamster 28 · Dwarf Hamsters 24
 *      (Russian/Campbells/Chinese/Roborovski) · any other/unresolvable -> 31
 *    Driving the weaning reminders: utils/animalAlertsCron.js daily push digest,
 *    NotificationsHub/NotificationBar "weaning due", routes/pushRoutes.js bell count.
 *    Reminders only fire inside the species' nursing window — reproStatusSync's
 *    Species.maxNursingDays safety-net cutoff closes them afterwards.
 *
 * 2) expectedDueDate = matingDate + the SPECIES' GESTATION:
 *      Fancy Mouse 19 · Fancy Rat 21 · Syrian Hamster 16 · Dwarf Hamsters 18
 *      · unknown species -> left blank (gestations vary too widely to guess)
 *    Driving the "births due" reminders in the same four places + the Calendar.
 *
 * Species resolution order (both rules): an explicit payload.species, else the litter's
 * dam's species (then the sire's) looked up in Animal with a PublicAnimal fallback.
 *
 * Every other user (id_public not in AUTO_WEANING_USER_IDS_PUBLIC) gets the payload back unchanged.
 *
 * Entry points (all async because of the species lookup, all MUTATE and return the
 * payload; `lookupSpecies` is an optional injectable override used by tests):
 *   - await applyAutoWeaningOnCreate(payload, idPublic[, lookup])
 *   - await applyAutoWeaningOnUpdate(payload, prior, idPublic[, lookup])
 *   - await applyAutoDueDateOnCreate(payload, idPublic[, lookup])
 *   - await applyAutoDueDateOnUpdate(payload, prior, idPublic[, lookup])
 * Used by POST/PUT /api/litters (routes/litterRoutes.js) and the bulk-import litter
 * creates (import/kintrak/zooeasy routes).
 *
 * What the rules do NOT do (on purpose):
 *   - Never overwrite a date the user typed themselves (an explicit payload value that
 *     differs from the stored one is respected).
 *   - Never touch a litter confirmed via "Wean Today" (weaningConfirmed) or flagged
 *     pregnancyLost — those are recorded events, not plans.
 */

const AUTO_WEANING_USER_IDS_PUBLIC = ['CTU2', 'CTU5', 'CTU107', 'CTU80'];
const AUTO_WEANING_USER_ID_PUBLIC = AUTO_WEANING_USER_IDS_PUBLIC[0]; // kept for back-compat
const DEFAULT_WEANING_AGE_DAYS = 31;

// Ordered species → weaning-age rules; first match wins against the normalised species
// name (lowercased, non-alphanumerics stripped). Matches the live catalogue strings
// ('Fancy Rat', 'Syrian Hamster', 'Russian Dwarf Hamster', 'Campbells Dwarf Hamster',
// 'Chinese Dwarf Hamster', 'Roborovski Dwarf Hamster', 'Fancy Mouse', 'Mouse', 'Rat').
const WEANING_AGE_RULES = [
    { days: 28, match: (n) => n.includes('syrian') && n.includes('hamster') }, // Syrian Hamster
    { days: 24, match: (n) => n.includes('dwarf') && n.includes('hamster') },  // * Dwarf Hamster
    { days: 35, match: (n) => n === 'rat' || n.includes('fancyrat') },         // Fancy Rat / Rat
    { days: 31, match: (n) => n.includes('mouse') },                           // Fancy Mouse / Mouse
];

// Every age the rule can produce — used to detect a stored "auto-derived" weaningDate.
const KNOWN_WEANING_AGE_DAYS = [...new Set([DEFAULT_WEANING_AGE_DAYS, ...WEANING_AGE_RULES.map((r) => r.days)])];

const isAutoWeaningUser = (idPublic) =>
    !!idPublic && AUTO_WEANING_USER_IDS_PUBLIC.includes(String(idPublic).toUpperCase());

const normaliseSpecies = (species) => String(species || '').toLowerCase().replace(/[^a-z0-9]/g, '');

/** Days after birth to auto-set for a species name (unresolvable/unknown -> default 31). */
const weaningAgeDaysForSpecies = (species) => {
    const n = normaliseSpecies(species);
    if (!n) return DEFAULT_WEANING_AGE_DAYS;
    const rule = WEANING_AGE_RULES.find((r) => r.match(n));
    return rule ? rule.days : DEFAULT_WEANING_AGE_DAYS;
};

// Calendar-day maths in UTC, matching how <input type="date"> values are stored
// (YYYY-MM-DD is cast to UTC midnight), so "+N days" lands on the same wall-clock
// day regardless of the server's timezone.
const computeWeaningDate = (birthDate, days = DEFAULT_WEANING_AGE_DAYS) => {
    if (!birthDate) return null;
    const d = new Date(birthDate);
    if (isNaN(d.getTime())) return null;
    d.setUTCDate(d.getUTCDate() + Number(days));
    return d;
};

// YYYY-MM-DD key (UTC) for date-only comparisons; null when unparseable.
const dayKey = (value) => {
    if (!value) return null;
    const d = new Date(value);
    if (isNaN(d.getTime())) return null;
    return d.toISOString().slice(0, 10);
};

const sameDay = (a, b) => {
    const ka = dayKey(a);
    const kb = dayKey(b);
    return ka !== null && ka === kb;
};

const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);
const isBlank = (v) => v === undefined || v === null || v === '';

// Resolves a litter's species from its parents (dam first, then sire): Animal with a
// PublicAnimal fallback. Lazy-requires models so this module loads cleanly in unit
// tests, and returns null when no DB connection is open or the lookup fails — which
// simply means "use the default weaning age".
const defaultSpeciesLookup = async (sireId_public, damId_public) => {
    const ids = [...new Set([damId_public, sireId_public].filter(Boolean))];
    if (!ids.length) return null;
    const { Animal, PublicAnimal } = require('../database/models');
    if (Animal.db.readyState !== 1) return null; // not connected (tests/scripts)
    try {
        const [animalDocs, publicDocs] = await Promise.all([
            Animal.find({ id_public: { $in: ids } }).select('id_public species').lean(),
            PublicAnimal.find({ id_public: { $in: ids } }).select('id_public species').lean(),
        ]);
        const speciesById = new Map();
        for (const d of [...animalDocs, ...publicDocs]) {
            if (d.species && !speciesById.has(d.id_public)) speciesById.set(d.id_public, d.species);
        }
        for (const id of ids) {
            if (speciesById.has(id)) return speciesById.get(id);
        }
    } catch {
        // fall through → default weaning age
    }
    return null;
};

// Was this stored weaningDate itself produced by the rule (any known age after birth)?
// If yes it stays "auto" and may be re-derived (the birthDate or species changed); if it
// was hand-entered it always wins.
const isAutoDerivedWeaningDate = (birthDate, weaningDate) =>
    !!birthDate && !!weaningDate &&
    KNOWN_WEANING_AGE_DAYS.some((days) => sameDay(weaningDate, computeWeaningDate(birthDate, days)));

/**
 * CREATE rule (async): when a birthDate exists and no weaningDate was supplied, fill in
 * birthDate + the species' weaning age. An explicitly provided weaningDate is left alone.
 * The optional 3rd arg injects a species lookup (tests pass a stub).
 */
const applyAutoWeaningOnCreate = async (payload, idPublic, lookupSpecies = defaultSpeciesLookup) => {
    if (!payload || !isAutoWeaningUser(idPublic)) return payload;
    if (isBlank(payload.birthDate)) return payload;
    if (!isBlank(payload.weaningDate)) return payload; // explicit value wins
    const explicitSpecies = typeof payload.species === 'string' && payload.species.trim()
        ? payload.species
        : null;
    const species = explicitSpecies ?? (await lookupSpecies(payload.sireId_public, payload.damId_public));
    const weaningDate = computeWeaningDate(payload.birthDate, weaningAgeDaysForSpecies(species));
    if (weaningDate) payload.weaningDate = weaningDate;
    return payload;
};

/**
 * UPDATE rule (async): keep weaningDate = birthDate + the species' weaning age in sync
 * for CTU2.
 *
 * @param {Object} payload  The PUT body (mutated in place).
 * @param {Object} prior    The stored litter — needs sireId_public/damId_public/
 *                          birthDate/weaningDate/weaningConfirmed (may be null on a
 *                          not-found lookup).
 * @param {String} idPublic The acting user's id_public (req.user.id_public).
 * @param {Function} [lookupSpecies] Optional species-lookup override (tests pass a stub).
 */
const applyAutoWeaningOnUpdate = async (payload, prior, idPublic, lookupSpecies = defaultSpeciesLookup) => {
    if (!payload || !isAutoWeaningUser(idPublic)) return payload;

    // "Wean Today" (or any later edit of a confirmed litter): real event, hands off.
    const confirmed = hasOwn(payload, 'weaningConfirmed')
        ? !!payload.weaningConfirmed
        : !!(prior && prior.weaningConfirmed);
    if (confirmed) return payload;

    // Effective birthDate: the one being set now, else the stored one.
    const birthProvided = hasOwn(payload, 'birthDate') && !isBlank(payload.birthDate);
    const birth = birthProvided ? payload.birthDate : (prior && prior.birthDate);
    if (isBlank(birth)) return payload;

    // Effective species: payload's, else looked up from the (new or stored) parents.
    const explicitSpecies = typeof payload.species === 'string' && payload.species.trim()
        ? payload.species
        : null;
    const sire = ((hasOwn(payload, 'sireId_public') && payload.sireId_public) || (prior && prior.sireId_public)) || null;
    const dam = ((hasOwn(payload, 'damId_public') && payload.damId_public) || (prior && prior.damId_public)) || null;
    const species = explicitSpecies ?? (await lookupSpecies(sire, dam));
    const auto = computeWeaningDate(birth, weaningAgeDaysForSpecies(species));
    if (!auto) return payload;

    const priorAuto = !!(prior && isAutoDerivedWeaningDate(prior.birthDate, prior.weaningDate));

    if (!hasOwn(payload, 'weaningDate')) {
        // Patch-style update (e.g. "Mated Today", toggle flags): fill a missing
        // date, re-derive an auto one after a birthDate change, otherwise leave it.
        if (isBlank(prior && prior.weaningDate)) payload.weaningDate = auto;
        else if (birthProvided && priorAuto) payload.weaningDate = auto;
        return payload;
    }

    if (isBlank(payload.weaningDate)) {
        // Form saved with the field empty → (re)apply the rule.
        payload.weaningDate = auto;
        return payload;
    }

    // The edit form echoes the stored value back verbatim; when that value was
    // auto-derived, re-derive it from the (possibly corrected) birthDate/species.
    if (priorAuto && prior && sameDay(payload.weaningDate, prior.weaningDate)) {
        payload.weaningDate = auto;
    }
    // Otherwise the user supplied/changed a date by hand → respect it.
    return payload;
};

// ── Expected due dates (auto-filled for CTU2 too) ─────────────────────────────
// Gestation: matingDate + species' days -> expectedDueDate, which drives the "births
// due" reminders (animalAlertsCron/pushRoutes digest + NotificationBar/NotificationsHub/
// Calendar). Same normalised-species matching as the weaning ages; UNKNOWN species get
// NO auto-fill (gestations vary too widely to guess) — unlike weaning, which falls back
// to 31.
const GESTATION_DAYS_RULES = [
    { days: 16, match: (n) => n.includes('syrian') && n.includes('hamster') }, // Syrian Hamster
    { days: 18, match: (n) => n.includes('dwarf') && n.includes('hamster') },  // * Dwarf Hamster
    { days: 21, match: (n) => n === 'rat' || n.includes('fancyrat') },         // Fancy Rat / Rat
    { days: 19, match: (n) => n.includes('mouse') },                           // Fancy Mouse / Mouse
];

// Every gestation the rule can produce — used to detect a stored "auto-derived" due date.
const KNOWN_GESTATION_DAYS = [...new Set(GESTATION_DAYS_RULES.map((r) => r.days))]; // 16,18,21,19

/** Gestation days after mating for a species name; null when unresolvable (no auto-fill). */
const gestationDaysForSpecies = (species) => {
    const n = normaliseSpecies(species);
    if (!n) return null;
    const rule = GESTATION_DAYS_RULES.find((r) => r.match(n));
    return rule ? rule.days : null;
};

// Calendar-day add in UTC — same convention as computeWeaningDate.
const computeExpectedDueDate = (matingDate, days) => {
    if (!matingDate || !days) return null;
    const d = new Date(matingDate);
    if (isNaN(d.getTime())) return null;
    d.setUTCDate(d.getUTCDate() + Number(days));
    return d;
};

// Was this stored expectedDueDate produced by the rule (any known gestation after mating)?
const isAutoDerivedDueDate = (matingDate, expectedDueDate) =>
    !!matingDate && !!expectedDueDate &&
    KNOWN_GESTATION_DAYS.some((days) => sameDay(expectedDueDate, computeExpectedDueDate(matingDate, days)));

/**
 * CREATE rule (async): when a matingDate exists and no expectedDueDate was supplied, fill
 * in matingDate + the species' gestation. An explicit value is left alone, pregnancy-lost
 * records are skipped (no due reminders for a lost pregnancy), and an unresolvable species
 * leaves the field blank rather than guessing. Optional 3rd arg injects a species lookup.
 */
const applyAutoDueDateOnCreate = async (payload, idPublic, lookupSpecies = defaultSpeciesLookup) => {
    if (!payload || !isAutoWeaningUser(idPublic)) return payload;
    if (isBlank(payload.matingDate) || !isBlank(payload.expectedDueDate)) return payload;
    if (payload.pregnancyLost) return payload;
    const explicitSpecies = typeof payload.species === 'string' && payload.species.trim()
        ? payload.species
        : null;
    const species = explicitSpecies ?? (await lookupSpecies(payload.sireId_public, payload.damId_public));
    const gestation = gestationDaysForSpecies(species);
    if (!gestation) return payload;
    const expectedDueDate = computeExpectedDueDate(payload.matingDate, gestation);
    if (expectedDueDate) payload.expectedDueDate = expectedDueDate;
    return payload;
};

/**
 * UPDATE rule (async): keep expectedDueDate = matingDate + the species' gestation in sync
 * for CTU2. Hand-entered due dates are respected; an auto-derived one re-derives when the
 * mating date (or species) changes — including the "Mated Today" patch, which moves a due
 * date auto-filled from the *scheduled* mating date onto the actual one. Pregnancy-lost
 * records are never touched. `prior` needs sireId_public/damId_public/matingDate/
 * expectedDueDate/pregnancyLost.
 */
const applyAutoDueDateOnUpdate = async (payload, prior, idPublic, lookupSpecies = defaultSpeciesLookup) => {
    if (!payload || !isAutoWeaningUser(idPublic)) return payload;

    const pregnancyLost = hasOwn(payload, 'pregnancyLost')
        ? !!payload.pregnancyLost
        : !!(prior && prior.pregnancyLost);
    if (pregnancyLost) return payload;

    const matingProvided = hasOwn(payload, 'matingDate') && !isBlank(payload.matingDate);
    const mating = matingProvided ? payload.matingDate : (prior && prior.matingDate);
    if (isBlank(mating)) return payload;

    const explicitSpecies = typeof payload.species === 'string' && payload.species.trim()
        ? payload.species
        : null;
    const sire = ((hasOwn(payload, 'sireId_public') && payload.sireId_public) || (prior && prior.sireId_public)) || null;
    const dam = ((hasOwn(payload, 'damId_public') && payload.damId_public) || (prior && prior.damId_public)) || null;
    const species = explicitSpecies ?? (await lookupSpecies(sire, dam));
    const gestation = gestationDaysForSpecies(species);
    if (!gestation) return payload;

    const auto = computeExpectedDueDate(mating, gestation);
    if (!auto) return payload;

    const priorAuto = !!(prior && isAutoDerivedDueDate(prior.matingDate, prior.expectedDueDate));

    if (!hasOwn(payload, 'expectedDueDate')) {
        // Patch-style update (e.g. "Mated Today"): fill a missing due date, re-derive an
        // auto one after a mating-date change, otherwise leave it (manual values win).
        if (isBlank(prior && prior.expectedDueDate)) payload.expectedDueDate = auto;
        else if (matingProvided && priorAuto) payload.expectedDueDate = auto;
        return payload;
    }

    if (isBlank(payload.expectedDueDate)) {
        // Form saved with the field empty -> (re)apply the rule.
        payload.expectedDueDate = auto;
        return payload;
    }

    // The edit form echoes the stored value back verbatim; when that value was
    // auto-derived, re-derive it from the (possibly corrected) mating date/species.
    if (priorAuto && prior && sameDay(payload.expectedDueDate, prior.expectedDueDate)) {
        payload.expectedDueDate = auto;
    }
    return payload; // otherwise the user supplied/changed it by hand -> respect it
};

module.exports = {
    AUTO_WEANING_USER_IDS_PUBLIC,
    AUTO_WEANING_USER_ID_PUBLIC,
    DEFAULT_WEANING_AGE_DAYS,
    KNOWN_WEANING_AGE_DAYS,
    isAutoWeaningUser,
    weaningAgeDaysForSpecies,
    computeWeaningDate,
    applyAutoWeaningOnCreate,
    applyAutoWeaningOnUpdate,
    gestationDaysForSpecies,
    computeExpectedDueDate,
    applyAutoDueDateOnCreate,
    applyAutoDueDateOnUpdate,
};