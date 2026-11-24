/**
 * reproStatusSync.js
 *
 * Single source of truth for computing an animal's reproductive status
 * (isPlannedMating / isInMating / isPregnant / isNursing) from its Litter
 * records. This is called automatically after every litter create/update/
 * delete (see routes/litterRoutes.js) so that the flags on the Animal /
 * PublicAnimal documents always reflect the current state of that animal's
 * litters regardless of which UI (LitterManagement, AnimalList's
 * Reproduction tab, imports, admin tools, etc.) triggered the change.
 *
 * It is also used by migrations/backfill-repro-status.js to correct any
 * existing production data that drifted out of sync before this module
 * existed.
 */
const { Animal, PublicAnimal, Litter, Species } = require('../database/models');

// Fallback cutoff (days) used when a litter's dam has no species match in the
// Species collection (e.g. a custom/user-added species never assigned one).
const DEFAULT_MAX_NURSING_DAYS = 90;

/**
 * Determine the single active reproductive status contributed by one litter.
 * Returns one of: 'nursing' | 'pregnant' | 'mating' | 'planned' | null.
 *
 * Stage transitions (planned -> mating, nursing -> closed) are driven by explicit user
 * actions (the "Mated Today" / "Wean Today" buttons), not merely by a date field being
 * present or having arrived a breeder must be able to record/correct a mating or
 * weaning date without that alone silently flipping the animal's status.
 *
 * A litter is considered "closed" (contributes no active status) once:
 *  - it has a birthDate and weaning was confirmed (weaningConfirmed === true), either by
 *    the explicit "Wean Today" action or by the auto-confirm at the cut-off below,
 *  - the pregnancy was recorded as lost (pregnancyLost === true) with no birth, or
 *  - it has a birthDate but wasn't confirmed weaned and more than `maxNursingDays` have
 *    passed since birth a safety-net cutoff so a litter the breeder forgot
 *    to mark as weaned doesn't leave the dam flagged "nursing" forever. The daily
 *    autoConfirmOverdueWeaning() job flips weaningConfirmed=true at this same cutoff.
 */
function getLitterReproStatus(litter, today = new Date(), maxNursingDays = DEFAULT_MAX_NURSING_DAYS) {
    const hasBirth = !!litter.birthDate;
    const isWeaned = !!litter.weaningConfirmed;
    const hasPregnancy = !!litter.pregnancyDate;
    const hasMatingDate = !!litter.matingDate;

    if (litter.pregnancyLost && !hasBirth) return null;
    // Born with an unknown birth date: no nursing window to count and no mating/planned state.
    if (litter.birthDateUnknown && !hasBirth) return null;
    if (hasBirth && isWeaned) return null; // fully weaned cycle complete

    if (hasBirth) {
        const daysSinceBirth = (today.getTime() - new Date(litter.birthDate).getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceBirth > maxNursingDays) return null; // past the species' realistic nursing window auto-close
        return 'nursing';
    }
    if (hasPregnancy) return 'pregnant';

    // isPlanned only clears via the explicit "Mated Today" action a matingDate arriving
    // (or being entered/corrected) on its own does not advance a planned mating to "mating".
    if (!litter.isPlanned && hasMatingDate) return 'mating';
    if (litter.isPlanned) return 'planned';
    return null;
}

/**
 * Pure computation of the 4 reproductive flags for one animal, given its
 * pre-fetched litters and a map of litter._id (string) -> maxNursingDays.
 * Exported separately so callers (e.g. the backfill migration) can preview
 * the result without writing to the database.
 */
function computeReproFlags(litters, id_public, nursingCutoffByLitter = new Map(), today = new Date()) {
    const sorted = [...litters].sort((a, b) => {
        const dateA = new Date(a.birthDate || a.pregnancyDate || a.matingDate || a.createdAt).getTime() || 0;
        const dateB = new Date(b.birthDate || b.pregnancyDate || b.matingDate || b.createdAt).getTime() || 0;
        return dateB - dateA;
    });

    let isPlannedMating = false;
    let isInMating = false;
    let isPregnant = false;
    let isNursing = false;

    for (const litter of sorted) {
        const maxNursingDays = nursingCutoffByLitter.get(String(litter._id)) ?? DEFAULT_MAX_NURSING_DAYS;
        const status = getLitterReproStatus(litter, today, maxNursingDays);
        if (!status) continue; // this litter is closed/resolved check the next most recent one

        const isDamRole = litter.damId_public === id_public;
        // Pregnant/nursing only ever apply to the dam's own body for a sire (or the non-dam
        // side of the pairing), this litter carries no status for THIS animal, so it must not
        // block older litters from being checked (e.g. a sire's separate, more recent planned
        // mating elsewhere).
        if ((status === 'pregnant' || status === 'nursing') && !isDamRole) continue;

        if (status === 'planned') isPlannedMating = true;
        else if (status === 'mating') isInMating = true;
        else if (status === 'pregnant') isPregnant = true;
        else if (status === 'nursing') isNursing = true;
        break; // only the most recent litter that actually applies to this animal's role determines its status
    }

    return { isPlannedMating, isInMating, isPregnant, isNursing };
}

/**
 * Given a batch of litters, resolve each litter's dam's species and look up
 * that species' maxNursingDays, returning a Map of litter._id (string) -> days.
 */
async function buildNursingCutoffMap(litters) {
    const cutoffByLitter = new Map();
    const damIds = [...new Set(litters.map((l) => l.damId_public).filter(Boolean))];
    if (!damIds.length) return cutoffByLitter;

    const dams = await Animal.find({ id_public: { $in: damIds } }).select('id_public species').lean();
    const speciesByDam = new Map(dams.map((d) => [d.id_public, d.species]));

    const speciesNames = [...new Set(dams.map((d) => d.species).filter(Boolean))];
    const speciesDocs = speciesNames.length
        ? await Species.find({ name: { $in: speciesNames } }).select('name maxNursingDays').lean()
        : [];
    const cutoffBySpeciesName = new Map(speciesDocs.map((s) => [s.name, s.maxNursingDays]));

    for (const litter of litters) {
        const damSpecies = litter.damId_public && speciesByDam.get(litter.damId_public);
        const cutoff = (damSpecies && cutoffBySpeciesName.get(damSpecies)) ?? DEFAULT_MAX_NURSING_DAYS;
        cutoffByLitter.set(String(litter._id), cutoff);
    }
    return cutoffByLitter;
}

/**
 * Recompute and persist isPlannedMating / isInMating / isPregnant / isNursing
 * for the given parent id_public(s), based on their most recent unresolved
 * litter. Dam-only flags (isPregnant/isNursing) are only ever set on the
 * animal acting as the litter's dam.
 */
async function syncParentReproStatus(creatorId, parentIdsPublic = []) {
    const parentIds = [...new Set((parentIdsPublic || []).filter(Boolean))];
    if (!parentIds.length) return;

    for (const id_public of parentIds) {
        const litters = await Litter.find({
            creatorId,
            $or: [{ sireId_public: id_public }, { damId_public: id_public }],
        }).select('sireId_public damId_public isPlanned matingDate pregnancyDate birthDate birthDateUnknown weaningDate weaningConfirmed pregnancyLost createdAt').lean();

        const nursingCutoffByLitter = await buildNursingCutoffMap(litters);
        const flags = computeReproFlags(litters, id_public, nursingCutoffByLitter);
        await Animal.updateOne({ creatorId, id_public }, { $set: flags });
        await PublicAnimal.updateOne({ id_public }, { $set: flags });
    }
}

/**
 * True when a born litter that was never manually confirmed ("Wean Today") has
 * aged past its species' nursing cut-off (Species.maxNursingDays, default 90)
 * and should now be auto-confirmed as weaned. Pure (no DB) so it is unit
 * tested; autoConfirmOverdueWeaning uses the same check to persist the flag.
 */
function shouldAutoConfirmWeaning(litter, cutoffDays = DEFAULT_MAX_NURSING_DAYS, now = new Date()) {
    if (!litter || !litter.birthDate) return false;
    if (litter.weaningConfirmed || litter.pregnancyLost) return false;
    const daysSinceBirth = (now.getTime() - new Date(litter.birthDate).getTime()) / (1000 * 60 * 60 * 24);
    return daysSinceBirth > cutoffDays;
}

/**
 * Auto-confirm weaning for born litters that are still unconfirmed once they
 * pass their species' nursing cut-off (Species.maxNursingDays, default 90).
 * Previously such litters were only "silently closed" (the dam's Nursing flag
 * cleared, the litter left as an unconfirmed "Expected weaning" forever); now
 * weaningConfirmed is flipped so survival stats, the "Weaned" timeline and the
 * dam's derived status all settle correctly. weaningDate is left untouched
 * (the flag alone distinguishes expected vs actual weaning).
 *
 * Called from the daily alert digest (utils/animalAlertsCron.js).
 *
 * @param {Date} [now] Overridable "today" for tests.
 * @returns {Promise<{confirmed: number, dams: string[]}>}
 */
async function autoConfirmOverdueWeaning(now = new Date()) {
    const litters = await Litter.find({
        weaningConfirmed: false,
        birthDate: { $ne: null },
        pregnancyLost: { $ne: true },
    }).select('creatorId damId_public birthDate').lean();

    const cutoffByLitter = await buildNursingCutoffMap(litters);
    const overdue = litters.filter((l) => shouldAutoConfirmWeaning(l, cutoffByLitter.get(String(l._id)), now));
    if (!overdue.length) return { confirmed: 0, dams: [] };

    const res = await Litter.updateMany(
        { _id: { $in: overdue.map((l) => l._id) }, weaningConfirmed: false },
        { $set: { weaningConfirmed: true } }
    );

    // Refresh the affected dams' derived reproductive flags (clears isNursing).
    const dams = new Map();
    for (const l of overdue) {
        if (l.damId_public) dams.set(String(l.damId_public), l.creatorId);
    }
    for (const [damId, creatorId] of dams) {
        try {
            await syncParentReproStatus(creatorId, [damId]);
        } catch (err) {
            console.error(`[reproStatusSync] Auto-confirm dam sync failed for ${damId}:`, err.message || err);
        }
    }

    return { confirmed: res.modifiedCount ?? overdue.length, dams: [...dams.keys()] };
}

module.exports = {
    syncParentReproStatus,
    getLitterReproStatus,
    computeReproFlags,
    buildNursingCutoffMap,
    shouldAutoConfirmWeaning,
    autoConfirmOverdueWeaning,
    DEFAULT_MAX_NURSING_DAYS,
};
