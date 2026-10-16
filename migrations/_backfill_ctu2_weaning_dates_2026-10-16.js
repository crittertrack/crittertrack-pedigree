/**
 * Backfill weaningDate = birthDate + the species' weaning age for every CTU2 litter that
 * has a birthDate (Fancy Mouse 31 / Fancy Rat 35 / Syrian Hamster 28 / Dwarf Hamster 24,
 * anything else 31 — see utils/autoWeaningDate.js).
 *
 * Why: CTU2's weaning reminders (utils/animalAlertsCron.js daily push digest,
 * NotificationsHub/NotificationBar "weaning due", pushRoutes alert-count) only fire
 * once the litter HAS a weaningDate. Litters created before the auto rule existed
 * (utils/autoWeaningDate.js) had none, so their reminders never appeared. Reminders are
 * additionally bounded by the Species.maxNursingDays safety-net cutoff, so backfilled
 * history that is past the nursing window doesn't alert.
 *
 * Scope:
 *   - Only litters created by CTU2 (creatorId), matching "my litters".
 *   - Litters already confirmed weaned via "Wean Today" (weaningConfirmed === true)
 *     keep their real weaning date — that's a recorded event, not a plan.
 *   - Litters without a birthDate are reported but untouched.
 *   - Everything else is (re)written to birthDate + that litter's species age, including
 *     existing values that differ, so the whole account follows one rule.
 *
 * Run:  node migrations/_backfill_ctu2_weaning_dates_2026-10-16.js [--apply]
 *       (dry-run by default; pass --apply to write)
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const { User, Litter, Animal, PublicAnimal } = require('../database/models');
const { computeWeaningDate, weaningAgeDaysForSpecies } = require('../utils/autoWeaningDate');

const OWNER_ID_PUBLIC = 'CTU2';
const APPLY = process.argv.includes('--apply');

const dayKey = (v) => {
    if (!v) return '(none)';
    const d = new Date(v);
    return isNaN(d.getTime()) ? '(invalid)' : d.toISOString().slice(0, 10);
};
const label = (l) => l.litter_id_public || l.breedingPairCodeName || String(l._id);

(async () => {
    await mongoose.connect(process.env.MONGODB_URI);

    const owner = await User.findOne({ id_public: OWNER_ID_PUBLIC }).select('_id id_public').lean();
    if (!owner) throw new Error(`${OWNER_ID_PUBLIC} not found`);

    const litters = await Litter.find({ creatorId: owner._id })
        .select('litter_id_public breedingPairCodeName sireId_public damId_public birthDate weaningDate weaningConfirmed')
        .sort({ birthDate: 1 })
        .lean();

    // Resolve the parents' species in two batched queries (dam first per litter) so each
    // litter gets ITS species' weaning age rather than one global number.
    const parentIds = [...new Set(litters.flatMap((l) => [l.sireId_public, l.damId_public]).filter(Boolean))];
    const [animalDocs, publicDocs] = parentIds.length
        ? await Promise.all([
            Animal.find({ id_public: { $in: parentIds } }).select('id_public species').lean(),
            PublicAnimal.find({ id_public: { $in: parentIds } }).select('id_public species').lean(),
        ])
        : [[], []];
    const speciesById = new Map();
    for (const d of [...animalDocs, ...publicDocs]) {
        if (d.species && !speciesById.has(d.id_public)) speciesById.set(d.id_public, d.species);
    }
    const ageDaysFor = (l) => weaningAgeDaysForSpecies(speciesById.get(l.damId_public) || speciesById.get(l.sireId_public));

    const changes = [];
    const confirmed = [];
    const alreadyOk = [];
    const noBirth = [];

    for (const l of litters) {
        if (!l.birthDate) { noBirth.push(l); continue; }
        if (l.weaningConfirmed) { confirmed.push(l); continue; }
        const days = ageDaysFor(l);
        const target = computeWeaningDate(l.birthDate, days);
        if (!target) { noBirth.push(l); continue; }
        if (l.weaningDate && dayKey(l.weaningDate) === dayKey(target)) { alreadyOk.push(l); continue; }
        changes.push({ litter: l, target, days });
    }

    console.log('='.repeat(70));
    console.log(APPLY ? 'APPLYING' : 'DRY RUN (pass --apply to write)');
    console.log('CTU2 weaningDate backfill — birthDate + per-species weaning age');
    console.log('  Fancy Mouse 31 / Fancy Rat 35 / Syrian Hamster 28 / Dwarf Hamster 24 / other 31');
    console.log('='.repeat(70));
    console.log(`Owner        : ${owner.id_public} (${owner._id})`);
    console.log(`Total litters: ${litters.length}`);
    console.log(`  already OK : ${alreadyOk.length}`);
    console.log(`  to update  : ${changes.length}`);
    console.log(`  confirmed via "Wean Today" (kept as-is): ${confirmed.length}`);
    console.log(`  no birthDate (skipped)                 : ${noBirth.length}`);

    if (changes.length) {
        console.log('\nChanges:');
        for (const { litter: l, target, days } of changes) {
            console.log(`  ${label(l)} (born ${dayKey(l.birthDate)}, +${days}d): ${dayKey(l.weaningDate)} -> ${dayKey(target)}`);
        }
    }
    if (confirmed.length) {
        console.log('\nKept (weaning already confirmed):');
        confirmed.forEach(l => console.log(`  ${label(l)} (born ${dayKey(l.birthDate)}, weaned ${dayKey(l.weaningDate)})`));
    }
    if (noBirth.length) {
        console.log('\nSkipped (no birthDate):');
        noBirth.forEach(l => console.log(`  ${label(l)}`));
    }

    if (!APPLY) {
        console.log('\nNo changes written.');
        await mongoose.disconnect();
        return;
    }

    for (const { litter: l, target } of changes) {
        await Litter.updateOne({ _id: l._id }, { $set: { weaningDate: target } });
    }
    console.log(`\nUpdated ${changes.length} litter(s).`);

    await mongoose.disconnect();
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });