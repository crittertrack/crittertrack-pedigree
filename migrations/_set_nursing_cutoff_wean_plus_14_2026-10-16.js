/**
 * Set Species.maxNursingDays = species weaning age + margin for every species that has an
 * auto-calculated weaning date (weaning ages come from utils/autoWeaningDate.js, so the
 * two can never drift apart).
 *
 *   Margin: +14 days for RODENTS, +31 days for OTHER MAMMALS (rabbit, ferret, cat, dog,
 *   hedgehog).
 *
 * Why: maxNursingDays is the safety-net cutoff after which an unconfirmed litter's weaning
 * reminder stops and the dam's Nursing flag auto-clears (utils/reproStatusSync.js).
 *
 * Only touches the `maxNursingDays` field of the named species. Prints old -> new.
 * (Filename kept from the first version of this script, which was a flat +14.)
 *
 * Usage:
 *   node migrations/_set_nursing_cutoff_wean_plus_14_2026-10-16.js           # dry run
 *   node migrations/_set_nursing_cutoff_wean_plus_14_2026-10-16.js --apply   # write
 */
require('dotenv').config();
const mongoose = require('mongoose');
const { weaningAgeDaysForSpecies } = require('../utils/autoWeaningDate');

const RODENT_MARGIN_DAYS = 14;
const OTHER_MAMMAL_MARGIN_DAYS = 31;

const RODENTS = [
    'Fancy Mouse', 'Fancy Rat', 'Syrian Hamster',
    'Russian Dwarf Hamster', 'Campbells Dwarf Hamster', 'Chinese Dwarf Hamster', 'Roborovski Dwarf Hamster',
    'Guinea Pig', 'Gerbil', 'Fat-tailed Gerbil', 'Natal Rats', 'Degu', 'Chinchilla',
    'Prairie Dog', 'Deer mouse', 'African Pygmy Mouse',
    'African Pygmy Dormouse',
];
const OTHER_MAMMALS = ['Rabbit', 'Rabbit (Domesticated)', 'Ferret', 'Cat', 'Dog', 'Hedgehog'];

const TARGETS = [
    ...RODENTS.map((name) => ({ name, margin: RODENT_MARGIN_DAYS })),
    ...OTHER_MAMMALS.map((name) => ({ name, margin: OTHER_MAMMAL_MARGIN_DAYS })),
];

(async () => {
    const apply = process.argv.includes('--apply');
    await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
    const col = mongoose.connection.db.collection('species');

    console.log(apply ? 'APPLY MODE' : 'DRY RUN (add --apply to write)');
    for (const { name, margin } of TARGETS) {
        const doc = await col.findOne({ name }, { projection: { maxNursingDays: 1 } });
        if (!doc) { console.log(`${name}: NOT FOUND — skipped`); continue; }
        const wean = weaningAgeDaysForSpecies(name);
        const target = wean + margin;
        const old = doc.maxNursingDays ?? null;
        console.log(`${name}: wean ${wean} + ${margin} -> maxNursingDays ${old} => ${target}${old === target ? ' (unchanged)' : ''}`);
        if (apply && old !== target) {
            await col.updateOne({ _id: doc._id }, { $set: { maxNursingDays: target } });
        }
    }
    await mongoose.disconnect();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
