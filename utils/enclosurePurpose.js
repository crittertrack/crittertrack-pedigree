/**
 * Canonical enclosure "purpose" values — the single source of truth shared by the
 * Enclosure schema and the POST/PUT routes.
 *
 * The option list historically lived in three places that had drifted apart: the Mongoose
 * enum, the two frontend <select> dropdowns, and the Health tab's enclosure filter. Because
 * the enum rejected the values the UI actually offered, saving an enclosure whose purpose
 * was "Quarantine" failed with a generic 500. Anything adding a purpose here must also add
 * it to the two frontend dropdowns (they are standalone apps and cannot import this file).
 */

// Order matters — it drives the order of the dropdown in every enclosure form.
const ENCLOSURE_PURPOSE_OPTIONS = [
    { value: 'general', label: 'General' },
    { value: 'reproduction', label: 'Nursery / Breeding' },
    { value: 'medical', label: 'Medical' },
    { value: 'quarantine', label: 'Quarantine' },
    { value: 'sale', label: 'For Sale' },
    { value: 'other', label: 'Other' },
];

const ENCLOSURE_PURPOSE_VALUES = ENCLOSURE_PURPOSE_OPTIONS.map((o) => o.value);

const DEFAULT_ENCLOSURE_PURPOSE = 'general';

// Older builds shipped a single combined "Health/Quarantine" option stored as 'health', plus
// an empty-string default. Both are still accepted so existing enclosures keep loading and
// keep saving; 'health' is deliberately left in the schema enum for the same reason.
const LEGACY_PURPOSE_ALIASES = {
    health: 'quarantine',
    '': DEFAULT_ENCLOSURE_PURPOSE,
};

/**
 * Coerce an incoming purpose to a canonical value.
 * @returns {string|null} the canonical purpose, or null if the value isn't recognised.
 */
function normalizeEnclosurePurpose(value) {
    if (value === undefined || value === null) return DEFAULT_ENCLOSURE_PURPOSE;
    const raw = String(value).trim().toLowerCase();
    if (ENCLOSURE_PURPOSE_VALUES.includes(raw)) return raw;
    if (Object.prototype.hasOwnProperty.call(LEGACY_PURPOSE_ALIASES, raw)) {
        return LEGACY_PURPOSE_ALIASES[raw];
    }
    return null;
}

// Medical and Quarantine enclosures are both grouped into the Health tab's enclosure panel.
function isHealthEnclosurePurpose(value) {
    const normalized = normalizeEnclosurePurpose(value);
    return normalized === 'medical' || normalized === 'quarantine';
}

module.exports = {
    ENCLOSURE_PURPOSE_OPTIONS,
    ENCLOSURE_PURPOSE_VALUES,
    DEFAULT_ENCLOSURE_PURPOSE,
    normalizeEnclosurePurpose,
    isHealthEnclosurePurpose,
};