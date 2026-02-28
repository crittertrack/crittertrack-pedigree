/**
 * Migration: Consolidate ownerName / currentOwner / currentOwnerDisplay → keeperName.
 *
 * Finds all Animal and PublicAnimal documents that still have data in the old
 * fields, copies the best available value into keeperName, then unsets the
 * obsolete fields so no "owner" terminology remains on keeper text fields.
 *
 * Priority: currentOwnerDisplay > currentOwner > ownerName
 *
 * Usage:
 *   node migrate-keeper-name.js           # live run
 *   node migrate-keeper-name.js --dry-run  # preview only, no writes
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { Animal, PublicAnimal } = require('./database/models');

const DRY_RUN = process.argv.includes('--dry-run');

async function run() {
    const MONGODB_URI = process.env.MONGODB_URI;
    if (!MONGODB_URI) {
        console.error('❌  MONGODB_URI not found in environment variables.');
        process.exit(1);
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log('  Migrate keeperName (consolidate old owner text fields)');
    console.log(`  Mode : ${DRY_RUN ? 'DRY RUN (no writes)' : '*** LIVE RUN ***'}`);
    console.log(`${'='.repeat(60)}\n`);

    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB.\n');

    // Documents that still have any of the old fields with a non-empty value
    const staleFilter = {
        $or: [
            { ownerName: { $exists: true, $nin: [null, ''] } },
            { currentOwner: { $exists: true, $nin: [null, ''] } },
            { currentOwnerDisplay: { $exists: true, $nin: [null, ''] } },
        ]
    };

    // -------------------------------------------------------------------------
    // Animal collection
    // -------------------------------------------------------------------------
    const privateAnimals = await Animal.find(staleFilter)
        .select('id_public name species keeperName ownerName currentOwner currentOwnerDisplay')
        .lean();

    console.log(`Found ${privateAnimals.length} Animal document(s) with stale owner text field(s).`);

    let privateUpdated = 0;
    for (const a of privateAnimals) {
        const resolved = a.currentOwnerDisplay || a.currentOwner || a.ownerName || '';
        const label = `[${a.id_public || a._id}] ${a.name || '(unnamed)'} (${a.species || '?'})`;

        if (!resolved) {
            // All stale fields are empty — just unset them
            console.log(`  ${label} — stale fields empty, will unset only`);
        } else {
            const alreadyHas = a.keeperName ? ` (keeperName already: "${a.keeperName}", skipping copy)` : '';
            console.log(`  ${label} — keeperName ← "${resolved}"${alreadyHas}`);
        }

        if (!DRY_RUN) {
            const setOp = {};
            if (resolved && !a.keeperName) setOp.keeperName = resolved;

            await Animal.updateOne(
                { _id: a._id },
                {
                    ...(Object.keys(setOp).length ? { $set: setOp } : {}),
                    $unset: { ownerName: '', currentOwner: '', currentOwnerDisplay: '' }
                }
            );
            privateUpdated++;
        }
    }

    if (!DRY_RUN && privateUpdated > 0) {
        console.log(`\n✅  Animal: processed ${privateUpdated} document(s).`);
    }

    // -------------------------------------------------------------------------
    // PublicAnimal collection (only had currentOwnerDisplay)
    // -------------------------------------------------------------------------
    const publicStaleFilter = {
        $or: [
            { currentOwnerDisplay: { $exists: true, $nin: [null, ''] } },
            { currentOwner: { $exists: true, $nin: [null, ''] } },
        ]
    };

    const publicAnimals = await PublicAnimal.find(publicStaleFilter)
        .select('id_public name species keeperName currentOwner currentOwnerDisplay')
        .lean();

    console.log(`\nFound ${publicAnimals.length} PublicAnimal document(s) with stale owner text field(s).`);

    let publicUpdated = 0;
    for (const a of publicAnimals) {
        const resolved = a.currentOwnerDisplay || a.currentOwner || '';
        const label = `[${a.id_public || a._id}] ${a.name || '(unnamed)'} (${a.species || '?'})`;
        const alreadyHas = a.keeperName ? ` (keeperName already: "${a.keeperName}", skipping copy)` : '';
        console.log(`  ${label} — keeperName ← "${resolved}"${alreadyHas}`);

        if (!DRY_RUN) {
            const setOp = {};
            if (resolved && !a.keeperName) setOp.keeperName = resolved;

            await PublicAnimal.updateOne(
                { _id: a._id },
                {
                    ...(Object.keys(setOp).length ? { $set: setOp } : {}),
                    $unset: { currentOwnerDisplay: '', currentOwner: '' }
                }
            );
            publicUpdated++;
        }
    }

    if (!DRY_RUN && publicUpdated > 0) {
        console.log(`\n✅  PublicAnimal: processed ${publicUpdated} document(s).`);
    }

    // -------------------------------------------------------------------------
    // Summary
    // -------------------------------------------------------------------------
    const total = privateAnimals.length + publicAnimals.length;
    console.log(`\n${'='.repeat(60)}`);
    if (DRY_RUN) {
        console.log(`  DRY RUN complete. ${total} document(s) would be updated.`);
        console.log('  Run without --dry-run to apply changes.');
    } else {
        console.log(`  Migration complete. ${total} document(s) processed.`);
        console.log('  Old fields (ownerName, currentOwner, currentOwnerDisplay) unset.');
    }
    console.log(`${'='.repeat(60)}\n`);

    await mongoose.connection.close();
    console.log('Database connection closed.');
    process.exit(0);
}

run().catch(async (err) => {
    console.error('Migration failed:', err);
    try { await mongoose.connection.close(); } catch (_) {}
    process.exit(1);
});
