const leoProfanity = require('leo-profanity');

// Initialize dictionary only once per process
leoProfanity.clearList();
leoProfanity.loadDictionary('en');
// Allow internal prefixes/suffixes that might look like profanity tokens
leoProfanity.remove(['ctc', 'ctu']);

// Allow animal-specific terminology that may be flagged incorrectly
// 'bareback' is a recognized rat coat/pattern type
// 'nude' is a recognized hairless variety / colour descriptor
// 'butt' is a common innocuous pet name/nickname component (e.g. "Butt Fluff")
leoProfanity.remove(['bareback', 'nude', 'butt']);

class ProfanityError extends Error {
    constructor(fieldLabel = 'field', badWords = []) {
        const detail = badWords.length ? ` ("${badWords.join('", "')}")` : '';
        super(`The ${fieldLabel} contains inappropriate language${detail}.`);
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

// leoProfanity.check() only says whether the whole string is flagged, not which
// word did it — check word-by-word so the error can name the actual offender.
const findProfaneWords = (value) => {
    return value.split(/\s+/).filter(word => leoProfanity.check(word));
};

const assertCleanText = (value, fieldLabel) => {
    const normalized = normalizeInput(value);
    if (!normalized) return;
    if (isProfane(normalized)) {
        throw new ProfanityError(fieldLabel, findProfaneWords(normalized));
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
