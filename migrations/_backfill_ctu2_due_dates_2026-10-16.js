/**
 * Backfill expectedDueDate = matingDate + the species' gestation for every CTU2 litter
 * that has a matingDate but NO expectedDueDate (Fancy Mouse 19 / Fancy Rat 21 /
 * Syrian Hamster 16 / Dwarf Hamster 18 — see utils/autoWeaningDate.js).
 *
 * Why: expectedDueDate drives the "births due" reminders (digest push, bell badge,
 * NotificationBar/NotificationsHub, Calendar). 140 of CTU2's 141 mated litters were
 * missing it, so the due-date reminder had never fired.
 *
 * Scope: fill only where MISSING — an existing/hand-entered due date is never
 * overwritten. Litters without a matingDate, records flagged pregnancyLost, and litters
 * whose species can't be resolved to a known gestation are reported but skipped.
 * Computed due dates landing AFTER the recorded birth (estimated/odd mating date) are
 * flagged with `!` but still written.
 *
 * Run:  node migrations/_backfill_ctu2_due_dates_2026-10-16.js [--apply]
 *       (dry-run by default; pass --apply to write)
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const { User, Litter, Animal, PublicAnimal } = require('../database/models');
const { computeExpectedDueDate, gestationDaysForSpecies } = require('../utils/autoWeaningDate');

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

    const litters = await Litter.find({ creatorId: owner._id, matingDate: { $ne: null }, expectedDueDate: null })
        .select('litter_id_public breedingPairCodeName sireId_public damId_public matingDate expectedDueDate birthDate pregnancyLost')
        .sort({ matingDate: 1 })
        .lean();

    // Resolve the parents' species in two batched queries (dam first per litter).
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
    const gestationFor = (l) => gestationDaysForSpecies(speciesById.get(l.damId_public) || speciesById.get(l.sireId_public));

    const changes = [];
    const lost = [];
    const unknownSpecies = [];

    for (const l of litters) {
        if (l.pregnancyLost) { lost.push(l); continue; }
        const gestation = gestationFor(l);
        if (!gestation) { unknownSpecies.push(l); continue; }
        changes.push({ litter: l, target: computeExpectedDueDate(l.matingDate, gestation), gestation });
    }

    const hadDue = await Litter.countDocuments({ creatorId: owner._id, matingDate: { $ne: null }, expectedDueDate: { $ne: null } });

    console.log('='.repeat(70));
    console.log(APPLY ? 'APPLYING' : 'DRY RUN (pass --apply to write)');
    console.log('CTU2 expectedDueDate backfill — matingDate + per-species gestation');
    console.log('  Fancy Mouse 19 / Fancy Rat 21 / Syrian Hamster 16 / Dwarf Hamster 18 / unknown: skip');
    console.log('='.repeat(70));
    console.log(`Owner        : ${owner.id_public} (${owner._id})`);
    console.log(`Mated litters missing a due date : ${litters.length}`);
    console.log(`  to update                     : ${changes.length}`);
    console.log(`  already has a due date (kept) : ${hadDue}`);
    console.log(`  pregnancyLost (skipped)       : ${lost.length}`);
    console.log(`  unknown species (skipped)     : ${unknownSpecies.length}`);

    if (changes.length) {
        console.log('\nChanges:');
        for (const { litter: l, target, gestation } of changes) {
            const afterBirth = l.birthDate && target > new Date(l.birthDate) ? '  ! due-after-birth' : '';
            console.log(`  ${label(l)} (mated ${dayKey(l.matingDate)}, +${gestation}d): -> ${dayKey(target)}${afterBirth}`);
        }
    }
    if (lost.length) {
        console.log('\nSkipped (pregnancy lost):');
        lost.forEach(l => console.log(`  ${label(l)}`));
    }
    if (unknownSpecies.length) {
        console.log('\nSkipped (species not in gestation table):');
        unknownSpecies.forEach(l => console.log(`  ${label(l)}`));
    }

    if (!APPLY) {
        console.log('\nNo changes written.');
        await mongoose.disconnect();
        return;
    }

    for (const { litter: l, target } of changes) {
        await Litter.updateOne({ _id: l._id }, { $set: { expectedDueDate: target } });
    }
    console.log(`\nUpdated ${changes.length} litter(s).`);

    await mongoose.disconnect();
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });