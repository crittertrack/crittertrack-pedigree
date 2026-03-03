/**
 * Migration: remove-private-from-public-collection
 *
 * One-time cleanup: removes any animals from the publicanimals collection
 * where isPrivate === true. These ended up there because the sync logic
 * previously only checked showOnPublicProfile, not isPrivate.
 *
 * Run with:
 *   node migrations/remove-private-from-public-collection.js             (live run)
 *   node migrations/remove-private-from-public-collection.js --dry-run   (preview only)
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');

const DRY_RUN = process.argv.includes('--dry-run');
function log(msg) { process.stdout.write(msg + '\n'); }

async function main() {
    const uri = process.env.MONGODB_URI || process.env.DB_URI;
    if (!uri) { log('ERROR: No DB URI found'); process.exit(1); }

    await mongoose.connect(uri);
    log(`Connected to DB (${DRY_RUN ? 'DRY RUN' : 'LIVE RUN'})`);

    const PublicAnimal = mongoose.model('PublicAnimal',
        new mongoose.Schema({}, { strict: false, collection: 'publicanimals' })
    );

    // Find stale private animals in the public collection
    const stale = await PublicAnimal.find({ isPrivate: true }).lean();
    log(`Found ${stale.length} private animal(s) in publicanimals collection`);

    for (const a of stale) {
        log(`  - ${a.id_public} (${a.name || 'unnamed'})`);
    }

    if (stale.length === 0) {
        log('Nothing to clean up.');
    } else if (DRY_RUN) {
        log('\nDRY RUN — no changes made.');
    } else {
        const result = await PublicAnimal.deleteMany({ isPrivate: true });
        log(`\nDeleted ${result.deletedCount} private animal(s) from publicanimals.`);
    }

    await mongoose.disconnect();
    log('Done.');
}

main().catch(err => { console.error(err); process.exit(1); });
