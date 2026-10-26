/**
 * "Born, birth date unknown" a plain born entry with its own class.
 *
 * Saved as: birthDateUnknown = true, birthDate = null (NO date is ever invented), isPlanned = false.
 * Because there is no birthDate nothing is derived from it: no age, no nursing status, no weaning
 * date/reminder, and no auto-filled due or weaning dates. A real birth date always wins and clears
 * the flag.
 */
const normaliseUnknownBirth = (payload) => {
    if (!payload) return payload;
    if (payload.birthDate) {
        payload.birthDateUnknown = false;
        return payload;
    }
    if (payload.birthDateUnknown === true) {
        payload.birthDate = null;
        payload.isPlanned = false;
        payload.weaningDate = null;
        payload.weaningConfirmed = false;
    }
    return payload;
};

/** Effective flag: the payload's own value when it carries one, else the stored litter's. */
const isUnknownBirth = (payload, prior = null) =>
    Object.prototype.hasOwnProperty.call(payload || {}, 'birthDateUnknown')
        ? !!payload.birthDateUnknown
        : !!(prior && prior.birthDateUnknown);

module.exports = { normaliseUnknownBirth, isUnknownBirth };
