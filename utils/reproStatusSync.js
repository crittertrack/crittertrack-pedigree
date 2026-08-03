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
const { Animal, PublicAnimal, Litter } = require('../database/models');

/**
 * Determine the single active reproductive status contributed by one litter.
 * Returns one of: 'nursing' | 'pregnant' | 'mating' | 'planned' | null.
 *
 * A litter is considered "closed" (contributes no active status) once:
 *  - it has both a birthDate and a weaningDate (the litter has fully weaned), or
 *  - the pregnancy was recorded as lost (pregnancyLost === true) with no birth.
 */
function getLitterReproStatus(litter, today = new Date()) {
    const hasBirth = !!litter.birthDate;
    const hasWeaning = !!litter.weaningDate;
    const hasPregnancy = !!litter.pregnancyDate;
    const hasMatingDate = !!litter.matingDate;

    if (litter.pregnancyLost && !hasBirth) return null;
    if (hasBirth && hasWeaning) return null; // fully weaned — cycle complete

    if (hasBirth) return 'nursing';
    if (hasPregnancy) return 'pregnant';

    const mated = hasMatingDate && new Date(litter.matingDate) <= today;
    if (mated || (!litter.isPlanned && hasMatingDate)) return 'mating';
    if (litter.isPlanned && (!hasMatingDate || new Date(litter.matingDate) > today)) return 'planned';
    return null;
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

    const today = new Date();

    for (const id_public of parentIds) {
        const litters = await Litter.find({
            creatorId,
            $or: [{ sireId_public: id_public }, { damId_public: id_public }],
        }).select('sireId_public damId_public isPlanned matingDate pregnancyDate birthDate weaningDate pregnancyLost createdAt').lean();

        // Most recent litter (by the most relevant date) first.
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
            const status = getLitterReproStatus(litter, today);
            if (!status) continue; // this litter is closed/resolved — check the next most recent one

            const isDamRole = litter.damId_public === id_public;
            if (status === 'planned') isPlannedMating = true;
            else if (status === 'mating') isInMating = true;
            else if (status === 'pregnant' && isDamRole) isPregnant = true;
            else if (status === 'nursing' && isDamRole) isNursing = true;
            break; // only the most recent unresolved litter determines current status
        }

        const flags = { isPlannedMating, isInMating, isPregnant, isNursing };
        await Animal.updateOne({ creatorId, id_public }, { $set: flags });
        await PublicAnimal.updateOne({ id_public }, { $set: flags });
    }
}

module.exports = { syncParentReproStatus, getLitterReproStatus };
