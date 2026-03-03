/**
 * Migration: restore-hidden-view-only
 *
 * Clears the hiddenForUsers array on ALL view-only animals (animals where
 * viewOnlyForUsers has at least one entry). This migrates any sold/transferred
 * animals that were previously hidden by users into the new Management >
 * Sold / Transferred section, ensuring zero data loss when the legacy
 * "hidden tray" feature is removed.
 *
 * Safe to re-run — calling it again after the first run is a no-op since
 * hiddenForUsers will already be empty.
 *
 * Run with:
 *   node migrations/restore-hidden-view-only.js             (live run)
 *   node migrations/restore-hidden-view-only.js --dry-run   (preview only, no writes)
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');

const DRY_RUN = process.argv.includes('--dry-run');

function log(msg) {
    process.stdout.write(msg + '\n');
}

async function main() {
    const uri = process.env.MONGODB_URI || process.env.DB_URI;
    if (!uri) {
        log('ERROR: MONGODB_URI is not set in environment. Aborting.');
        process.exit(1);
    }

    await mongoose.connect(uri);
    log(`Connected to MongoDB${DRY_RUN ? ' [DRY RUN — no writes]' : ''}`);

    const { Animal } = require('../database/models');

    // Find all animals that:
    //  1. have at least one entry in viewOnlyForUsers (i.e. are view-only/transferred animals)
    //  2. have at least one entry in hiddenForUsers (i.e. were hidden by a user)
    const affected = await Animal.find({
        viewOnlyForUsers: { $exists: true, $not: { $size: 0 } },
        hiddenForUsers:   { $exists: true, $not: { $size: 0 } },
    }).lean();

    if (affected.length === 0) {
        log('No hidden view-only animals found. Nothing to migrate.');
        await mongoose.disconnect();
        return;
    }

    log(`Found ${affected.length} animals with hidden view-only users:`);
    log('');

    let cleared = 0;
    let skipped = 0;

    for (const animal of affected) {
        const name = [animal.prefix, animal.name, animal.suffix].filter(Boolean).join(' ');
        const hiddenCount = animal.hiddenForUsers.length;
        const viewOnlyCount = animal.viewOnlyForUsers.length;

        log(`  [${animal.id_public}] "${name}" (${animal.species})`);
        log(`      hiddenForUsers:   ${hiddenCount} user(s) — will be cleared`);
        log(`      viewOnlyForUsers: ${viewOnlyCount} user(s) — retained (view-only access unchanged)`);

        if (!DRY_RUN) {
            try {
                await Animal.updateOne(
                    { _id: animal._id },
                    { $set: { hiddenForUsers: [] } }
                );
                cleared++;
            } catch (err) {
                log(`      ERROR: ${err.message} — skipping`);
                skipped++;
            }
        } else {
            cleared++; // count as "would clear" in dry run
        }
    }

    log('');
    if (DRY_RUN) {
        log(`Dry run complete. Would have cleared hiddenForUsers on ${cleared} animal(s).`);
    } else {
        log(`Migration complete. Cleared hiddenForUsers on ${cleared} animal(s)${skipped > 0 ? `, ${skipped} skipped due to errors` : ''}.`);
    }

    await mongoose.disconnect();
    log('Disconnected.');
}

main().catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
});
