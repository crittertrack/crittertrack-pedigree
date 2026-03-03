/**
 * Migration: grant-view-only-ctu2
 *
 * Grants CTU2 view-only (Sold/Transferred) access to three animals
 * that were added by CTU10 but bred by CTU2:
 *   - CTC698
 *   - CTC707
 *   - CTC699
 *
 * Adds CTU2's backend _id to viewOnlyForUsers on each animal using
 * $addToSet (idempotent — safe to re-run).
 * Also sets soldStatus = 'sold' on each so CTU2's Sold/Transferred
 * section surfaces them correctly.
 *
 * Run with:
 *   node migrations/grant-view-only-ctu2.js             (live run)
 *   node migrations/grant-view-only-ctu2.js --dry-run   (preview only, no writes)
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');

const DRY_RUN = process.argv.includes('--dry-run');
const ANIMAL_IDS = ['CTC698', 'CTC707', 'CTC699'];
const BREEDER_PUBLIC_ID = 'CTU2';

function log(msg) { process.stdout.write(msg + '\n'); }

async function main() {
    const uri = process.env.MONGODB_URI || process.env.DB_URI;
    if (!uri) { log('ERROR: MONGODB_URI not set. Aborting.'); process.exit(1); }

    await mongoose.connect(uri);
    log(`Connected to MongoDB${DRY_RUN ? ' [DRY RUN — no writes]' : ''}`);

    const { Animal, User } = require('../database/models');

    // Resolve CTU2's backend _id
    const breeder = await User.findOne({ id_public: BREEDER_PUBLIC_ID }).lean();
    if (!breeder) { log(`ERROR: User ${BREEDER_PUBLIC_ID} not found.`); process.exit(1); }
    log(`Found user ${BREEDER_PUBLIC_ID}: ${breeder.personalName || breeder.breederName} (_id: ${breeder._id})`);

    // Find the target animals
    const animals = await Animal.find({ id_public: { $in: ANIMAL_IDS } }).lean();
    log(`\nFound ${animals.length}/${ANIMAL_IDS.length} animals:`);

    for (const id of ANIMAL_IDS) {
        const a = animals.find(x => x.id_public === id);
        if (!a) { log(`  ❌ ${id} — NOT FOUND`); continue; }

        const alreadyHasAccess = (a.viewOnlyForUsers || []).map(String).includes(String(breeder._id));
        log(`  ${id} — "${a.name}" (owner: ${a.ownerId_public || a.ownerId}) — view-only already: ${alreadyHasAccess}, soldStatus: ${a.soldStatus || 'none'}`);

        if (!DRY_RUN) {
            await Animal.updateOne(
                { _id: a._id },
                {
                    $addToSet: { viewOnlyForUsers: breeder._id },
                    $set: { soldStatus: a.soldStatus || 'sold' }
                }
            );
            log(`    ✅ Updated`);
        } else {
            log(`    ℹ️  Would add CTU2 to viewOnlyForUsers + ensure soldStatus`);
        }
    }

    log('\nDone.');
    await mongoose.disconnect();
}

main().catch(err => { console.error(err); process.exit(1); });
