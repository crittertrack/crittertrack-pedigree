/**
 * reproStatusSync.js
 *
 * Single source of truth for computing an animal's reproductive status
 * (isPlannedMating / isInMating / isPregnant / isNursing) from its Litter
 * records. This is called automatically after every litter create/update/
 * delete (see routes/litterRoutes.js) so that the flags on the Animal /
 * PublicAnimal documents always reflect the current state of that animal's
 * litters — regardless of which UI (LitterManagement, AnimalList's
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
 * present or having arrived — a breeder must be able to record/correct a mating or
 * weaning date without that alone silently flipping the animal's status.
 *
 * A litter is considered "closed" (contributes no active status) once:
 *  - it has a birthDate and weaning was explicitly confirmed (weaningConfirmed === true),
 *  - the pregnancy was recorded as lost (pregnancyLost === true) with no birth, or
 *  - it has a birthDate but wasn't confirmed weaned and more than `maxNursingDays` have
 *    passed since birth — a safety-net cutoff so a litter the breeder forgot
 *    to mark as weaned doesn't leave the dam flagged "nursing" forever.
 */
function getLitterReproStatus(litter, today = new Date(), maxNursingDays = DEFAULT_MAX_NURSING_DAYS) {
    const hasBirth = !!litter.birthDate;
    const isWeaned = !!litter.weaningConfirmed;
    const hasPregnancy = !!litter.pregnancyDate;
    const hasMatingDate = !!litter.matingDate;

    if (litter.pregnancyLost && !hasBirth) return null;
    if (hasBirth && isWeaned) return null; // fully weaned — cycle complete

    if (hasBirth) {
        const daysSinceBirth = (today.getTime() - new Date(litter.birthDate).getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceBirth > maxNursingDays) return null; // past the species' realistic nursing window — auto-close
        return 'nursing';
    }
    if (hasPregnancy) return 'pregnant';

    // isPlanned only clears via the explicit "Mated Today" action — a matingDate arriving
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
        if (!status) continue; // this litter is closed/resolved — check the next most recent one

        const isDamRole = litter.damId_public === id_public;
        // Pregnant/nursing only ever apply to the dam's own body — for a sire (or the non-dam
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
        }).select('sireId_public damId_public isPlanned matingDate pregnancyDate birthDate weaningDate weaningConfirmed pregnancyLost createdAt').lean();

        const nursingCutoffByLitter = await buildNursingCutoffMap(litters);
        const flags = computeReproFlags(litters, id_public, nursingCutoffByLitter);
        await Animal.updateOne({ creatorId, id_public }, { $set: flags });
        await PublicAnimal.updateOne({ id_public }, { $set: flags });
    }
}

module.exports = { syncParentReproStatus, getLitterReproStatus, computeReproFlags, buildNursingCutoffMap, DEFAULT_MAX_NURSING_DAYS };
