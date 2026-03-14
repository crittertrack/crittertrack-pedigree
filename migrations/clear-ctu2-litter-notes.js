/**
 * Migration: clear-ctu2-litter-notes
 *
 * Clears the `notes` field on all litters owned by CTU2.
 *
 * Run with:
 *   node migrations/clear-ctu2-litter-notes.js             (live run)
 *   node migrations/clear-ctu2-litter-notes.js --dry-run   (preview only, no writes)
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');

const DRY_RUN = process.argv.includes('--dry-run');
const BREEDER_PUBLIC_ID = 'CTU2';

function log(msg) { process.stdout.write(msg + '\n'); }

async function main() {
    const uri = process.env.MONGODB_URI || process.env.DB_URI;
    if (!uri) { log('ERROR: MONGODB_URI not set. Aborting.'); process.exit(1); }

    await mongoose.connect(uri);
    log(`Connected to MongoDB${DRY_RUN ? ' [DRY RUN — no writes]' : ''}`);

    const { Litter, User } = require('../database/models');

    const breeder = await User.findOne({ id_public: BREEDER_PUBLIC_ID }).lean();
    if (!breeder) { log(`ERROR: User ${BREEDER_PUBLIC_ID} not found.`); process.exit(1); }
    log(`Found user ${BREEDER_PUBLIC_ID}: ${breeder.personalName || breeder.breederName} (_id: ${breeder._id})`);

    const litters = await Litter.find({ ownerId: breeder._id, notes: { $nin: [null, ''] } }).lean();
    log(`\nFound ${litters.length} litter(s) with notes:`);

    for (const litter of litters) {
        log(`  ${litter.litter_id_public || litter._id} — notes: "${litter.notes.slice(0, 80)}${litter.notes.length > 80 ? '…' : ''}"`);
        if (!DRY_RUN) {
            await Litter.updateOne({ _id: litter._id }, { $set: { notes: '' } });
            log(`    ✅ Cleared`);
        } else {
            log(`    ℹ️  Would clear notes`);
        }
    }

    if (litters.length === 0) log('  (none found)');
    log('\nDone.');
    await mongoose.disconnect();
}

main().catch(err => { console.error(err); process.exit(1); });
