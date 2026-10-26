/**
 * Life Stage calculation utilities.
 *
 * Life stage is derived from the animal's age (days since birthDate),
 * using per-species thresholds. These thresholds are based on typical
 * lifespan and sexual maturity ranges for each species.
 *
 * Species lifecycle stages (adjusted for typical lifespans):
 *   - Newborn:          0-2 weeks
 *   - Juvenile:         2-6 weeks (up to weaning, ~4 weeks)
 *   - Sub-adult:        ~6 weeks - 6 months
 *   - Adult:            ~6 months - 75% of typical lifespan
 *   - Senior:           ~75%+ of typical lifespan onwards
 *
 * Species-specific typical adult lifespans (years):
 *   Mouse/Fancy Mouse:    2
 *   Rat:                  3
 *   Hamster (all):        2-3
 *   Guinea Pig:           5-7
 *   Rabbit:               8-12
 *   Chinchilla:           10-15
 *
 * Example for Fancy Mouse (2 yr ~ 730 days):
 *   Newborn:   0-21 days
 *   Juvenile:  22-42 days
 *   Sub-adult: 43-90 days
 *   Adult:     91 days - ~547 days (75% of 730)
 *   Senior:    548+ days
 */

const SPECIES_LIFESPAN_YEARS = {
    'mouse': 2,
    'fancy mouse': 2,
    'fancy mouse (2 yr)': 2,
    'rat': 3,
    'fancy rat': 3,
    'hamster': 2,
    'syrian hamster': 2,
    'dwarf hamster': 2,
    'guinea pig': 6,
    'rabbit': 8,
    'chinchilla': 10,
    'degus': 6,
    'gerbil': 3,
};

const WEEKS_PER_DAY = 7;

/**
 * Get the typical adult lifespan in days for a species.
 * @param {string} species - The species name.
 * @returns {number} Lifespan in days, or null if not found.
 */
function getLifespanDays(species) {
    if (!species) return null;
    const key = typeof species === 'string' ? species.toLowerCase().trim() : '';
    const mapped = SPECIES_LIFESPAN_YEARS[key] || SPECIES_LIFESPAN_YEARS[key.replace(/[\s\-_]+/g, ' ')];

    if (mapped === undefined) {
        // Fall back to a generic rodent default of ~2 years
        return 2 * 365;
    }

    return mapped * 365;
}

/**
 * Calculate life stage from a birth date and species.
 * @param {Date|null|undefined} birthDate - The animal's birth date.
 * @param {string} [species] - The animal's species (e.g. 'Fancy Mouse', 'Rat', 'Guinea Pig').
 * @returns {string} One of: 'Newborn', 'Juvenile', 'Sub-adult', 'Adult', 'Senior', 'Unknown'
 */
function calculateLifeStageFromBirthDate(birthDate, species) {
    if (!birthDate) {
        return 'Unknown';
    }

    const birth = new Date(birthDate);
    // Check if the date is valid
    if (isNaN(birth.getTime())) {
        return 'Unknown';
    }

    const ageMs = Date.now() - birth.getTime();
    const ageDays = Math.floor(ageMs / (1000 * 60 * 60 * 24));

    // No lifespan known -> use generic rodent default
    const lifespanDays = getLifespanDays(species) || 730; // 2 years default
    const adultThreshold = lifespanDays * 0.75; // 75% of lifespan = senior threshold

    // Newborn: first 2 weeks (14 days)
    if (ageDays <= 14) {
        return 'Newborn';
    }

    // Juvenile: 2-6 weeks
    if (ageDays <= 42) {
        return 'Juvenile';
    }

    // Sub-adult: 6 weeks - 6 months (~180 days)
    if (ageDays <= 180) {
        return 'Sub-adult';
    }

    // Adult: 6 months - 75% of lifespan
    if (ageDays <= adultThreshold) {
        return 'Adult';
    }

    // Senior
    return 'Senior';
}

module.exports = {
    calculateLifeStageFromBirthDate,
    getLifespanDays,
    SPECIES_LIFESPAN_YEARS,
};

