/**
 * Set CTU8 animal statuses based on priority cascade:
 *   1. Has imageUrl         → Pet
 *   2. Prefix "TnS"        → Breeder
 *   3. Prefix "Mysigonek"  → Available
 *   4. Prefix "CMM"        → Booked
 *   5. Prefix "Mohanah"    → Retired
 *   6. Everything else      → Unknown
 *
 * Skips animals already marked Deceased.
 *
 * Usage:
 *   DRY RUN:  node migrations/set-CTU8-status-by-prefix.js
 *   EXECUTE:  CONFIRM=true node migrations/set-CTU8-status-by-prefix.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const { Animal, PublicAnimal } = require('../database/models');

const DRY_RUN = process.env.CONFIRM !== 'true';

async function main() {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : '*** LIVE ***'}\n`);

    const animals = await Animal.find({ ownerId_public: 'CTU8' })
        .select('id_public name prefix status imageUrl')
        .lean();

    const buckets = { Pet: [], Breeder: [], Available: [], Booked: [], Retired: [], Unknown: [], skipped: [] };

    for (const a of animals) {
        // Skip deceased animals
        if (a.status === 'Deceased') {
            buckets.skipped.push(a);
            continue;
        }

        let newStatus;
        if (a.imageUrl) {
            newStatus = 'Pet';
        } else if (a.prefix === 'TnS') {
            newStatus = 'Breeder';
        } else if (a.prefix === 'Mysigonek') {
            newStatus = 'Available';
        } else if (a.prefix === 'CMM') {
            newStatus = 'Booked';
        } else if (a.prefix === 'Mohanah') {
            newStatus = 'Retired';
        } else {
            newStatus = 'Unknown';
        }

        buckets[newStatus].push(a);
    }

    console.log('Results:');
    console.log(`  Skipped (Deceased):  ${buckets.skipped.length}`);
    console.log(`  Pet (has image):     ${buckets.Pet.length}`);
    console.log(`  Breeder (TnS):      ${buckets.Breeder.length}`);
    console.log(`  Available (Mysigonek): ${buckets.Available.length}`);
    console.log(`  Booked (CMM):        ${buckets.Booked.length}`);
    console.log(`  Retired (Mohanah):   ${buckets.Retired.length}`);
    console.log(`  Unknown (rest):      ${buckets.Unknown.length}`);
    console.log(`  Total:               ${animals.length}\n`);

    if (DRY_RUN) {
        console.log('Run with CONFIRM=true to apply changes.');
        await mongoose.disconnect();
        return;
    }

    // Apply updates in bulk per status
    let updated = 0;
    for (const [status, list] of Object.entries(buckets)) {
        if (status === 'skipped' || list.length === 0) continue;
        const ids = list.map(a => a.id_public);
        const res1 = await Animal.updateMany({ id_public: { $in: ids } }, { $set: { status } });
        const res2 = await PublicAnimal.updateMany({ id_public: { $in: ids } }, { $set: { status } });
        console.log(`  ${status}: updated ${res1.modifiedCount} Animal + ${res2.modifiedCount} PublicAnimal`);
        updated += res1.modifiedCount;
    }

    console.log(`\nDone! ${updated} animals updated.`);
    await mongoose.disconnect();
}

main().catch(err => { console.error(err); process.exit(1); });
