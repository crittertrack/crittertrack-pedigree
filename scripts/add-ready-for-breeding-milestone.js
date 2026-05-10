/**
 * add-ready-for-breeding-milestone.js
 *
 * For CTU2 animals with status "Breeder":
 *   - Adds a one-time milestone "Ready for Breeding" dated 4.5 months after birthDate
 *   - Skips animals that already have a milestone with this label
 *   - Skips animals with no valid birthDate
 *
 * Run with: node scripts/add-ready-for-breeding-milestone.js
 * Add --dry-run to preview without saving.
 */
const mongoose = require('mongoose');
require('dotenv').config();
const { Animal } = require('../database/models');

const DRY_RUN = process.argv.includes('--dry-run');
const LABEL = 'Ready for Breeding';
// 4.5 months: add 4 calendar months + 15 days
function calcReadyDate(birthDate) {
    const d = new Date(birthDate);
    if (isNaN(d.getTime())) return null;
    d.setMonth(d.getMonth() + 4);
    d.setDate(d.getDate() + 15);
    return d;
}

async function run() {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const animals = await Animal.find({
        ownerId_public: 'CTU2',
        status: 'Breeder',
        birthDate: { $exists: true, $ne: null },
    }).select('_id id_public name prefix suffix birthDate milestones');

    console.log(`Found ${animals.length} CTU2 Breeder animals`);

    let updated = 0;
    let skipped = 0;
    let noDate = 0;

    for (const a of animals) {
        // Skip if milestone already exists
        const already = (a.milestones || []).some(
            m => m.label && m.label.trim().toLowerCase() === LABEL.toLowerCase()
        );
        if (already) {
            const displayName = [a.prefix, a.name, a.suffix].filter(Boolean).join(' ') || a.id_public;
            console.log(`  SKIP (already has milestone): ${displayName} (${a.id_public})`);
            skipped++;
            continue;
        }

        const readyDate = calcReadyDate(a.birthDate);
        if (!readyDate) {
            console.log(`  SKIP (invalid birthDate): ${a.id_public}`);
            noDate++;
            continue;
        }

        const displayName = [a.prefix, a.name, a.suffix].filter(Boolean).join(' ') || a.id_public;
        console.log(`  ${DRY_RUN ? '[DRY] ' : ''}Add milestone to ${displayName} (${a.id_public}) → ${readyDate.toISOString().substring(0, 10)}`);

        if (!DRY_RUN) {
            await Animal.updateOne(
                { _id: a._id },
                {
                    $push: {
                        milestones: {
                            label: LABEL,
                            startDate: readyDate,
                            interval: null,
                            intervalUnit: null,
                        },
                    },
                }
            );
        }
        updated++;
    }

    console.log(`\nDone. Updated: ${updated}, Already had milestone: ${skipped}, No birthDate: ${noDate}`);
    if (DRY_RUN) console.log('(DRY RUN — no changes saved)');
    await mongoose.disconnect();
}

run().catch(err => { console.error(err); process.exit(1); });
