const leoProfanity = require('leo-profanity');

// Initialize dictionary only once per process
leoProfanity.clearList();
leoProfanity.loadDictionary('en');
// Allow internal prefixes/suffixes that might look like profanity tokens
leoProfanity.remove(['ctc', 'ctu']);

// Allow animal-specific terminology that may be flagged incorrectly
// 'bareback' is a recognized rat coat/pattern type
leoProfanity.remove(['bareback']);

class ProfanityError extends Error {
    constructor(fieldLabel = 'field') {
        super(`The ${fieldLabel} contains inappropriate language.`);
        this.name = 'ProfanityError';
        this.statusCode = 400;
    }
}

const normalizeInput = (value) => {
    if (!value || typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
};

const isProfane = (value) => {
    const normalized = normalizeInput(value);
    if (!normalized) return false;
    return leoProfanity.check(normalized);
};

const assertCleanText = (value, fieldLabel) => {
    const normalized = normalizeInput(value);
    if (!normalized) return;
    if (isProfane(normalized)) {
        throw new ProfanityError(fieldLabel);
    }
};

const sanitizeText = (value) => {
    const normalized = normalizeInput(value);
    if (!normalized) return value;
    return leoProfanity.clean(normalized);
};

module.exports = {
    ProfanityError,
    assertCleanText,
    isProfane,
    sanitizeText
};
