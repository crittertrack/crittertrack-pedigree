/**
 * A dam must be alive when the litter is born. A dam whose deceased date is before the litter's
 * birth date cannot be assigned. Sires are exempt (they may die after mating).
 *
 * Only enforced when a save actually sets the birth date or the dam, so an already-inconsistent
 * litter can still have unrelated fields (notes, counts, weaning) edited. Litters born with an
 * unknown birth date have no date to compare against, so they are skipped.
 */
const { Animal, PublicAnimal } = require('../database/models');

const dayKey = (value) => {
    if (!value) return null;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
};

/** Pure check. Returns an error message, or null when the dam is fine. Same-day death is allowed. */
const damDeceasedBeforeBirth = ({ damName, damId, deceasedDate, birthDate }) => {
    const died = dayKey(deceasedDate);
    const born = dayKey(birthDate);
    if (!died || !born || died >= born) return null;
    return `Dam ${damName ? `${damName} ` : ''}(${damId}) was deceased before the litter's birth date.`;
};

/**
 * Which dam / birth date does this save end up with, and does it need checking?
 * `updates` is the request body, `prior` the stored litter (null on create).
 */
const resolveDamCheck = (updates = {}, prior = null) => {
    const touches = 'birthDate' in updates || 'damId_public' in updates;
    if (!touches) return null;
    if (updates.birthDateUnknown === true || (!('birthDateUnknown' in updates) && prior?.birthDateUnknown)) return null;
    const damId = 'damId_public' in updates ? updates.damId_public : prior?.damId_public;
    const birthDate = 'birthDate' in updates ? updates.birthDate : prior?.birthDate;
    if (!damId || !birthDate) return null;
    return { damId, birthDate };
};

/** Returns an error message, or null. Looks the dam up in the owner's animals, then the public ones. */
const checkDamAliveAtBirth = async (updates, prior = null) => {
    const target = resolveDamCheck(updates, prior);
    if (!target) return null;
    const fields = 'name deceasedDate';
    const dam = (await Animal.findOne({ id_public: target.damId }).select(fields).lean())
        || (await PublicAnimal.findOne({ id_public: target.damId }).select(fields).lean());
    if (!dam) return null;
    return damDeceasedBeforeBirth({ damName: dam.name, damId: target.damId, deceasedDate: dam.deceasedDate, birthDate: target.birthDate });
};

module.exports = { checkDamAliveAtBirth, damDeceasedBeforeBirth, resolveDamCheck };
