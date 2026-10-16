/**
 * One-off data tidy for litters that had no status at all (not planned, no mating/birth/pregnancy
 * date) but clearly record a born litter.
 *
 *   A) REAL birth date, taken from the litter's linked pups (all pups must agree):
 *        CTL857 -> 2026-05-30      CTL859 -> 2026-06-04
 *   B) "Born, birth date unknown" (birthDateUnknown = true, birthDate stays empty):
 *        CTL577-581, CTL1074, CTL1103, CTL1104
 *
 * Safety: a litter is only changed if it STILL looks the way it did when checked — no birthDate,
 * not planned, no mating/pregnancy date, not already flagged. Anything else is skipped and reported.
 * For (A) the linked pups' birth dates are re-read and must equal the expected date.
 * Only the fields named above are written.
 *
 * Usage:
 *   node migrations/_fix_statusless_litters_2026-10-16.js           # dry run
 *   node migrations/_fix_statusless_litters_2026-10-16.js --apply   # write
 */
require('dotenv').config();
const mongoose = require('mongoose');

const REAL_DATE = { CTL857: '2026-05-30', CTL859: '2026-06-04' };
const UNKNOWN = ['CTL577', 'CTL578', 'CTL579', 'CTL580', 'CTL581', 'CTL1074', 'CTL1103', 'CTL1104'];

const day = (v) => (v ? new Date(v).toISOString().slice(0, 10) : null);

(async () => {
    const apply = process.argv.includes('--apply');
    await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
    const db = mongoose.connection.db;
    const litters = db.collection('litters');
    const animals = db.collection('animals');

    console.log(apply ? 'APPLY MODE' : 'DRY RUN (add --apply to write)');
    let changed = 0, skipped = 0;

    const stillStatusless = (l) =>
        l && !l.birthDate && !l.birthDateUnknown && l.isPlanned !== true && !l.matingDate && !l.pregnancyDate;

    // A) real birth dates
    for (const [id, expected] of Object.entries(REAL_DATE)) {
        const l = await litters.findOne({ litter_id_public: id });
        if (!l) { console.log(`${id}: NOT FOUND - skipped`); skipped++; continue; }
        if (!stillStatusless(l)) { console.log(`${id}: no longer status-less (changed since check) - skipped`); skipped++; continue; }
        const pups = await animals.find({ id_public: { $in: l.offspringIds_public || [] } }, { projection: { birthDate: 1 } }).toArray();
        const dates = [...new Set(pups.map((p) => day(p.birthDate)))];
        if (!pups.length || dates.length !== 1 || dates[0] !== expected) {
            console.log(`${id}: pup birth dates are [${dates.join(', ') || 'none'}], expected ${expected} - skipped`); skipped++; continue;
        }
        console.log(`${id}: birthDate (none) => ${expected}   (from ${pups.length} linked pup(s), all agree)`);
        if (apply) await litters.updateOne({ _id: l._id }, { $set: { birthDate: new Date(`${expected}T00:00:00.000Z`), isPlanned: false } });
        changed++;
    }

    // B) born, birth date unknown
    for (const id of UNKNOWN) {
        const l = await litters.findOne({ litter_id_public: id });
        if (!l) { console.log(`${id}: NOT FOUND - skipped`); skipped++; continue; }
        if (!stillStatusless(l)) { console.log(`${id}: no longer status-less (changed since check) - skipped`); skipped++; continue; }
        console.log(`${id}: birthDateUnknown false => true   (no birth date stored)`);
        if (apply) await litters.updateOne({ _id: l._id }, { $set: { birthDateUnknown: true, isPlanned: false } });
        changed++;
    }

    console.log(`\n${apply ? 'Updated' : 'Would update'}: ${changed}   Skipped: ${skipped}`);
    await mongoose.disconnect();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
