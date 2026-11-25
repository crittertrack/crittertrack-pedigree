'use strict';
/**
 * Backfill for CTU2: apply the "Mark Pregnant" due-date correction that now runs
 * live (utils/autoWeaningDate.applyAutoDueDateOnPregnancy) to litters that were
 * ALREADY marked pregnant with an expectedDueDate that has already passed.
 *
 * For each pending (not born, not lost) CTU2 litter with both a pregnancyDate and
 * a passed expectedDueDate, reset expectedDueDate to
 * pregnancyDate + PREGNANCY_DUE_RESET_PCT (50%) of the species' gestation so the
 * "birth due" reminder stops firing as permanently overdue.
 *
 * Reuses the exact same rule as the live fix (same species resolution, same 50%
 * window), so it can't drift. Litters without a pregnancyDate (mated but never
 * "Mark Pregnant") or without a gestation rule are left untouched, exactly like
 * the live fix.
 *
 * DRY RUN by default (reads only). Pass --confirm to write.
 */
const L = require('./lib');
const { applyAutoDueDateOnPregnancy } = require('../../utils/autoWeaningDate');

const OWNER = 'CTU2';

const day = (d) => {
    if (!d) return '-';
    const t = new Date(d);
    return isNaN(t.getTime()) ? String(d) : t.toISOString().slice(0, 10);
};

(async () => {
    await L.mongoose.connect(process.env.MONGODB_URI);
    const { Litter, User } = L.models;
    console.log(L.confirm ? '*** WRITING ***' : '--- DRY RUN (no writes) ---');

    const owner = await User.collection.findOne({ id_public: OWNER }, { projection: { _id: 1, id_public: 1 } });
    if (!owner) throw new Error(`${OWNER} user not found`);
    console.log(`Owner: ${owner.id_public} (${owner._id})`);

    const litters = await Litter.collection.find({
        creatorId: owner._id,
        pregnancyDate: { $ne: null },
        expectedDueDate: { $ne: null },
        birthDate: null,
        birthDateUnknown: { $ne: true },
        pregnancyLost: { $ne: true },
    }).project({
        litter_id_public: 1, breedingPairCodeName: 1,
        sireId_public: 1, damId_public: 1,
        pregnancyDate: 1, expectedDueDate: 1,
    }).toArray();
    console.log(`Loaded ${litters.length} pending ${OWNER} litters with a pregnancy + due date`);

    let changed = 0, unchanged = 0, errors = 0;
    for (const litter of litters) {
        const tag = litter.litter_id_public || litter.breedingPairCodeName || String(litter._id);
        try {
            const payload = { pregnancyDate: litter.pregnancyDate };
            await applyAutoDueDateOnPregnancy(payload, litter, owner.id_public);
            if (!payload.expectedDueDate) { unchanged++; continue; } // no reset needed

            const oldDay = day(litter.expectedDueDate);
            const newDay = day(payload.expectedDueDate);
            if (oldDay === newDay) { unchanged++; continue; }

            changed++;
            console.log(`UPDATE ${tag}: due ${oldDay} -> ${newDay} (pregnant ${day(litter.pregnancyDate)})`);
            if (L.confirm) {
                await Litter.collection.updateOne({ _id: litter._id }, { $set: { expectedDueDate: payload.expectedDueDate } });
            }
        } catch (e) {
            errors++;
            console.log(`ERROR ${tag}: ${e.message}`);
        }
    }

    console.log(`${L.confirm ? 'Updated' : 'Would update'}: ${changed} | no change needed: ${unchanged} | errors: ${errors}`);
    await L.mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });