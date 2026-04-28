/**
 * prefix-to-suffix.js
 *
 * Moves specific prefix values to suffix for affected animals.
 * The name field stays unchanged; only prefix is cleared and suffix is set.
 *
 * Rules:
 *   prefix "OP"              → suffix "Of Paradise"
 *   prefix "Mohanah"         → suffix "Mohanah"
 *   prefix "From MouseHouse" → suffix "From MouseHouse"
 *   prefix "Halmaus"         → suffix "Halmaus"
 *   prefix "MafiaSpade"      → suffix "MafiaSpade"
 *
 * Dry-run by default. Pass --apply to commit changes.
 */

const mongoose = require('mongoose');
require('dotenv').config();
const { Animal, PublicAnimal } = require('../database/models');

const DRY_RUN = !process.argv.includes('--apply');

const RULES = [
    { prefix: 'OP',              newSuffix: 'Of Paradise' },
    { prefix: 'Mohanah',         newSuffix: 'Mohanah' },
    { prefix: 'From MouseHouse', newSuffix: 'From MouseHouse' },
    { prefix: 'Halmaus',         newSuffix: 'Halmaus' },
    { prefix: 'MafiaSpade',      newSuffix: 'MafiaSpade' },
];

(async () => {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log(`Mode: ${DRY_RUN ? 'DRY RUN (pass --apply to commit)' : 'APPLY'}\n`);

    let totalUpdated = 0;

    for (const rule of RULES) {
        const prefixRegex = new RegExp(`^${rule.prefix.replace(/\s+/g, '\\s+')}$`, 'i');
        const animals = await Animal.find({ prefix: prefixRegex })
            .select('id_public name prefix suffix')
            .lean();

        console.log(`--- "${rule.prefix}" → suffix "${rule.newSuffix}" (${animals.length} animals) ---`);

        for (const a of animals) {
            const display = `  ${a.id_public}  prefix="${a.prefix}" name="${a.name}" suffix="${a.suffix || ''}"`;
            if (a.suffix && a.suffix.trim()) {
                console.log(`${display}  ⚠ already has suffix — will be overwritten`);
            } else {
                console.log(display);
            }
        }

        if (!DRY_RUN && animals.length > 0) {
            const ids = animals.map(a => a._id);
            const setFields = { prefix: null, suffix: rule.newSuffix };

            await Animal.updateMany({ _id: { $in: ids } }, { $set: setFields });

            const idPublics = animals.map(a => a.id_public);
            await PublicAnimal.updateMany({ id_public: { $in: idPublics } }, { $set: setFields });

            console.log(`  → Updated ${animals.length} Animal + PublicAnimal docs`);
            totalUpdated += animals.length;
        }

        console.log();
    }

    if (DRY_RUN) {
        console.log('=== DRY RUN — no changes made. Pass --apply to commit. ===');
    } else {
        console.log(`=== Done. Total updated: ${totalUpdated} animals ===`);
    }

    await mongoose.disconnect();
})();
