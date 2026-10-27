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

/**
 * Extended species-specific age thresholds (in days).
 * Each entry specifies the age cutoff for each life stage:
 *   newborn: age below which the animal is considered newborn
 *   juvenile: age below which the animal is considered juvenile
 *   sub_adult: age below which the animal is considered sub-adult
 *   senior_pct: percentage of lifespan at which the animal becomes senior
 */
const SPECIES_LIFE_STAGE_THRESHOLDS = {
    // Generic rodent defaults (used when no species-specific thresholds defined)
    mouse: {
        newborn: 21,
        juvenile: 42,
        sub_adult: 90,
        senior_pct: 0.75,
    },
    'fancy mouse': {
        newborn: 21,
        juvenile: 42,
        sub_adult: 90,
        senior_pct: 0.75,
    },
    rat: {
        newborn: 21,
        juvenile: 42,
        sub_adult: 90,
        senior_pct: 0.75,
    },
    'fancy rat': {
        newborn: 21,
        juvenile: 42,
        sub_adult: 90,
        senior_pct: 0.75,
    },
    hamster: {
        newborn: 14,
        juvenile: 42,
        sub_adult: 90,
        senior_pct: 0.75,
    },
    'syrian hamster': {
        newborn: 14,
        juvenile: 42,
        sub_adult: 90,
        senior_pct: 0.75,
    },
    'dwarf hamster': {
        newborn: 14,
        juvenile: 42,
        sub_adult: 90,
        senior_pct: 0.75,
    },
    'russian hamster': {
        newborn: 14,
        juvenile: 42,
        sub_adult: 90,
        senior_pct: 0.75,
    },
    'campbell\'s hamster': {
        newborn: 14,
        juvenile: 42,
        sub_adult: 90,
        senior_pct: 0.75,
    },
    guinea_pig: {
        newborn: 14,
        juvenile: 42,
        sub_adult: 180,
        senior_pct: 0.75,
    },
    rabbit: {
        newborn: 14,
        juvenile: 42,
        sub_adult: 180,
        senior_pct: 0.75,
    },
    chinchilla: {
        newborn: 14,
        juvenile: 42,
        sub_adult: 180,
        senior_pct: 0.75,
    },
    degu: {
        newborn: 14,
        juvenile: 42,
        sub_adult: 120,
        senior_pct: 0.75,
    },
    gerbil: {
        newborn: 14,
        juvenile: 42,
        sub_adult: 90,
        senior_pct: 0.75,
    },
    ferret: {
        newborn: 14,
        juvenile: 42,
        sub_adult: 180,
        senior_pct: 0.5,
    },
    cat: {
        newborn: 14,
        juvenile: 42,
        sub_adult: 180,
        senior_pct: 0.67,
    },
    'natal rats': {
        newborn: 14,
        juvenile: 42,
        sub_adult: 90,
        senior_pct: 0.75,
    },
    // Additional mammals from species collection
    'african pygmy mouse': {
        newborn: 14,
        juvenile: 42,
        sub_adult: 90,
        senior_pct: 0.75,
    },
    'african pygmy dormouse': {
        newborn: 14,
        juvenile: 42,
        sub_adult: 90,
        senior_pct: 0.75,
    },
    'campbells dwarf hamster': {
        newborn: 14,
        juvenile: 42,
        sub_adult: 90,
        senior_pct: 0.75,
    },
    'chinese dwarf hamster': {
        newborn: 14,
        juvenile: 42,
        sub_adult: 90,
        senior_pct: 0.75,
    },
    'deer mouse': {
        newborn: 14,
        juvenile: 42,
        sub_adult: 90,
        senior_pct: 0.75,
    },
    dog: {
        newborn: 14,
        juvenile: 42,
        sub_adult: 180,
        senior_pct: 0.75,
    },
    'fat-tailed gerbil': {
        newborn: 14,
        juvenile: 42,
        sub_adult: 90,
        senior_pct: 0.75,
    },
    hedgehog: {
        newborn: 14,
        juvenile: 42,
        sub_adult: 90,
        senior_pct: 0.75,
    },
    'prairie dog': {
        newborn: 14,
        juvenile: 42,
        sub_adult: 90,
        senior_pct: 0.75,
    },
    'rabbit (domesticated)': {
        newborn: 14,
        juvenile: 42,
        sub_adult: 180,
        senior_pct: 0.75,
    },
    'roborovski dwarf hamster': {
        newborn: 14,
        juvenile: 42,
        sub_adult: 90,
        senior_pct: 0.75,
    },
    'russian dwarf hamster': {
        newborn: 14,
        juvenile: 42,
        sub_adult: 90,
        senior_pct: 0.75,
    },
    'sugar glider': {
        newborn: 14,
        juvenile: 42,
        sub_adult: 180,
        senior_pct: 0.75,
    },
    'whitetail antsangy': {
        newborn: 14,
        juvenile: 42,
        sub_adult: 90,
        senior_pct: 0.75,
    },
    // Birds from species collection
    // Small passerines/finches/canaries/doves: hatchling → fledgling → independent quickly
    'african grey parrot': {
        newborn: 14,
        juvenile: 60,
        sub_adult: 365,
        senior_pct: 0.75,
    },
    budgie: {
        newborn: 7,
        juvenile: 21,
        sub_adult: 90,
        senior_pct: 0.75,
    },
    canary: {
        newborn: 7,
        juvenile: 21,
        sub_adult: 90,
        senior_pct: 0.75,
    },
    cockatiel: {
        newborn: 10,
        juvenile: 30,
        sub_adult: 180,
        senior_pct: 0.75,
    },
    cockatoo: {
        newborn: 14,
        juvenile: 60,
        sub_adult: 365,
        senior_pct: 0.75,
    },
    conure: {
        newborn: 10,
        juvenile: 30,
        sub_adult: 180,
        senior_pct: 0.75,
    },
    dove: {
        newborn: 7,
        juvenile: 21,
        sub_adult: 90,
        senior_pct: 0.75,
    },
    lovebird: {
        newborn: 10,
        juvenile: 30,
        sub_adult: 180,
        senior_pct: 0.75,
    },
    macaw: {
        newborn: 14,
        juvenile: 60,
        sub_adult: 365,
        senior_pct: 0.75,
    },
    'zebra finch': {
        newborn: 7,
        juvenile: 21,
        sub_adult: 90,
        senior_pct: 0.75,
    },
    // Reptiles from species collection
    // Snakes: hatchling independent quickly, slow to mature, long-lived
    'ball python': {
        newborn: 30,
        juvenile: 180,
        sub_adult: 365,
        senior_pct: 0.75,
    },
    'cape african house snake': {
        newborn: 30,
        juvenile: 180,
        sub_adult: 365,
        senior_pct: 0.75,
    },
    'corn snake': {
        newborn: 30,
        juvenile: 180,
        sub_adult: 365,
        senior_pct: 0.75,
    },
    'eastern kingsnake': {
        newborn: 30,
        juvenile: 180,
        sub_adult: 365,
        senior_pct: 0.75,
    },
    // Lizards & geckos: hatchling stage is brief, moderate maturity time
    'bearded dragon': {
        newborn: 14,
        juvenile: 90,
        sub_adult: 180,
        senior_pct: 0.75,
    },
    'banded knobtails gecko': {
        newborn: 14,
        juvenile: 90,
        sub_adult: 180,
        senior_pct: 0.75,
    },
    'centralian rough knobtail gecko': {
        newborn: 14,
        juvenile: 90,
        sub_adult: 180,
        senior_pct: 0.75,
    },
    'crested gecko': {
        newborn: 14,
        juvenile: 90,
        sub_adult: 180,
        senior_pct: 0.75,
    },
    'giant day gecko': {
        newborn: 14,
        juvenile: 90,
        sub_adult: 180,
        senior_pct: 0.75,
    },
    'green iguana': {
        newborn: 14,
        juvenile: 180,
        sub_adult: 365,
        senior_pct: 0.75,
    },
    'leopard gecko': {
        newborn: 14,
        juvenile: 90,
        sub_adult: 180,
        senior_pct: 0.75,
    },
    'pilbara knobtail gecko': {
        newborn: 14,
        juvenile: 90,
        sub_adult: 180,
        senior_pct: 0.75,
    },
    'thicktail gecko': {
        newborn: 14,
        juvenile: 90,
        sub_adult: 180,
        senior_pct: 0.75,
    },
    '3 lined knobtail gecko': {
        newborn: 14,
        juvenile: 90,
        sub_adult: 180,
        senior_pct: 0.75,
    },
    // Chameleons: shorter lifespan, relatively fast maturity
    chameleon: {
        newborn: 14,
        juvenile: 90,
        sub_adult: 180,
        senior_pct: 0.75,
    },
    // Blue-tongued skink: moderate maturity, long-lived
    'blue-tongued skink': {
        newborn: 14,
        juvenile: 90,
        sub_adult: 180,
        senior_pct: 0.75,
    },
    // Turtles & tortoises: slow to mature, very long-lived
    'red-eared slider': {
        newborn: 30,
        juvenile: 365,
        sub_adult: 730,
        senior_pct: 0.75,
    },
    'russian tortoise': {
        newborn: 30,
        juvenile: 365,
        sub_adult: 730,
        senior_pct: 0.75,
    },
};

/**
 * Map common species names to canonical keys for the thresholds lookup.
 */
const SPECIES_THRESHOLDS_KEY_MAP = {
    mouse: 'mouse',
    'fancy mouse': 'fancy mouse',
    rat: 'rat',
    'fancy rat': 'fancy rat',
    hamster: 'hamster',
    'syrian hamster': 'hamster',
    'dwarf hamster': 'hamster',
    'guinea pig': 'guinea_pig',
    rabbit: 'rabbit',
    chinchilla: 'chinchilla',
    degu: 'degu',
    gerbil: 'gerbil',
    ferret: 'ferret',
    cat: 'cat',
    'natal rats': 'natal rats',
    // Additional mammals from species collection
    'african pygmy mouse': 'african pygmy mouse',
    'african pygmy dormouse': 'african pygmy dormouse',
    'campbells dwarf hamster': 'campbells dwarf hamster',
    'chinese dwarf hamster': 'chinese dwarf hamster',
    'deer mouse': 'deer mouse',
    dog: 'dog',
    'fat tailed gerbil': 'fat-tailed gerbil',
    'fat-tailed gerbil': 'fat-tailed gerbil',
    hedgehog: 'hedgehog',
    'prairie dog': 'prairie dog',
    'rabbit (domesticated)': 'rabbit',
    'roborovski dwarf hamster': 'roborovski dwarf hamster',
    'russian dwarf hamster': 'russian dwarf hamster',
    'sugar glider': 'sugar glider',
    'whitetail antsangy': 'whitetail antsangy',
    // Birds from species collection
    'african grey parrot': 'african grey parrot',
    budgie: 'budgie',
    canary: 'canary',
    cockatiel: 'cockatiel',
    cockatoo: 'cockatoo',
    conure: 'conure',
    dove: 'dove',
    lovebird: 'lovebird',
    macaw: 'macaw',
    'zebra finch': 'zebra finch',
    // Reptiles from species collection
    'ball python': 'ball python',
    'cape african house snake': 'cape african house snake',
    'corn snake': 'corn snake',
    'eastern kingsnake': 'eastern kingsnake',
    'bearded dragon': 'bearded dragon',
    'banded knobtails gecko': 'banded knobtails gecko',
    'centralian rough knobtail gecko': 'centralian rough knobtail gecko',
    'crested gecko': 'crested gecko',
    'giant day gecko': 'giant day gecko',
    'green iguana': 'green iguana',
    'leopard gecko': 'leopard gecko',
    'pilbara knobtail gecko': 'pilbara knobtail gecko',
    'thicktail gecko': 'thicktail gecko',
    '3 lined knobtail gecko': '3 lined knobtail gecko',
    chameleon: 'chameleon',
    'blue-tongued skink': 'blue-tongued skink',
    'red-eared slider': 'red-eared slider',
    'russian tortoise': 'russian tortoise',
    // Amphibians from species collection
    'african clawed frog': 'african clawed frog',
    'fire-bellied toad': 'fire-bellied toad',
    'whites tree frog': 'whites tree frog',
    'dwarf african clawed frog': 'dwarf african clawed frog',
    'axolotl': 'axolotl',
    'red-eyed tree frog': 'red-eyed tree frog',
    // Normalized key map entries (spaces instead of hyphens/underscores for normalization compatibility)
    'red eared slider': 'red-eared slider',
    'blue tongued skink': 'blue-tongued skink',
    'african clawed frog': 'african clawed frog',
    'fire bellied toad': 'fire-bellied toad',
    'whites tree frog': 'whites tree frog',
    'dwarf african clawed frog': 'dwarf african clawed frog',
};
SPECIES_LIFESPAN_YEARS = {
    'mouse': 2,
    'fancy mouse': 2,
    'rat': 3,
    'fancy rat': 3,
    'hamster': 2,
    'syrian hamster': 2,
    'dwarf hamster': 2,
    'guinea pig': 6,
    'rabbit': 8,
    'chinchilla': 10,
    'degu': 6,
    'degus': 6,
    'gerbil': 3,
    'ferret': 7,
    'cat': 15,
    'natal rats': 3,
    // Additional mammals from species collection (lifespan in years, from AnAge/Wikipedia research)
    'african pygmy mouse': 4,
    'african pygmy dormouse': 7,
    'campbells dwarf hamster': 2,
    'chinese dwarf hamster': 3,
    'deer mouse': 8,
    dog: 12,
    'fat-tailed gerbil': 8,
    hedgehog: 4,
    'prairie dog': 5,
    'roborovski dwarf hamster': 3,
    'russian dwarf hamster': 2,
    'sugar glider': 10,
    'whitetail antsangy': 2,
    'rabbit (domesticated)': 8,
    // Birds from species collection (lifespan in years, from AnAge/Wikipedia research)
    'african grey parrot': 50,
    budgie: 21,
    canary: 24,
    cockatiel: 35,
    cockatoo: 50,
    conure: 25,
    dove: 15,
    lovebird: 12,
    macaw: 60,
    'zebra finch': 12,
    // Reptiles from species collection (lifespan in years, from AnAge/Wikipedia research)
    'ball python': 47,
    'cape african house snake': 15,
    'corn snake': 18,
    'eastern kingsnake': 20,
    'bearded dragon': 12,
    'banded knobtails gecko': 10,
    'centralian rough knobtail gecko': 10,
    'crested gecko': 15,
    'giant day gecko': 10,
    'green iguana': 20,
    'leopard gecko': 15,
    'pilbara knobtail gecko': 10,
    'thicktail gecko': 10,
    '3 lined knobtail gecko': 10,
    chameleon: 7,
    'blue-tongued skink': 18,
    'red-eared slider': 25,
    'russian tortoise': 40,
};

/** Map common species names to canonical keys for the thresholds lookup.

const WEEKS_PER_DAY = 7;

/** Get the life stage thresholds for a species.
 * @param {string} species - The species name.
 * @returns {object} Thresholds object with day cutoffs and senior percentage,
 *                   or generic rodent defaults if not found.
 */
function getLifeStageThresholds(species) {
    if (!species) return null;
    // Normalize species name: handle both 'guinea pig' and 'guinea_pig'
    const normalized = species.toLowerCase().trim().replace(/[\s\-_]+/g, ' ');
    const key = SPECIES_THRESHOLDS_KEY_MAP[normalized];
    if (key && SPECIES_LIFE_STAGE_THRESHOLDS[key]) {
        return SPECIES_LIFE_STAGE_THRESHOLDS[key];
    }
    // Return generic rodent defaults
    return {
        newborn: 21,
        juvenile: 42,
        sub_adult: 90,
        senior_pct: 0.75,
    };
}

/** Get the typical adult lifespan in days for a species.
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

    // Get species-specific day cutoffs
    const thresholds = getLifeStageThresholds(species);

    // No lifespan known -> use generic rodent default
    const lifespanDays = getLifespanDays(species) || 730; // 2 years default

    // Newborn: first threshold days
    if (ageDays <= thresholds.newborn) {
        return 'Newborn';
    }

    // Juvenile: newborn+1 to juvenile cutoff
    if (ageDays <= thresholds.juvenile) {
        return 'Juvenile';
    }

    // Sub-adult: juvenile+1 to sub_adult cutoff
    if (ageDays <= thresholds.sub_adult) {
        return 'Sub-adult';
    }

    // Adult/senior: use species-specific senior_pct if defined, else default 75%
    // Age between sub_adult cutoff and senior threshold = Adult
    // Age beyond senior threshold = Senior
    const seniorPct = thresholds.senior_pct !== undefined ? thresholds.senior_pct : 0.75;
    const seniorThreshold = lifespanDays * seniorPct; // Days at which animal becomes senior

    // If age is at or before the senior threshold, it's Adult
    if (ageDays <= seniorThreshold) {
        return 'Adult';
    }

    // Senior
    return 'Senior';
   }

module.exports = {
    calculateLifeStageFromBirthDate,
    getLifespanDays,
    getLifeStageThresholds,
    SPECIES_LIFESPAN_YEARS,
    SPECIES_LIFE_STAGE_THRESHOLDS,
    SPECIES_THRESHOLDS_KEY_MAP,
};

