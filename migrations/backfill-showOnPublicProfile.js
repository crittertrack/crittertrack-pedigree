/**
 * Migration: backfill-showOnPublicProfile
 * All documents in the publicanimals collection are by definition public.
 * This sets showOnPublicProfile = true on any doc that's missing the field.
 *
 * Run: node migrations/backfill-showOnPublicProfile.js [--dry-run]
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');

const DRY_RUN = process.argv.includes('--dry-run');
function log(msg) { process.stdout.write(msg + '\n'); }

async function main() {
    const uri = process.env.MONGODB_URI || process.env.DB_URI;
    if (!uri) { log('ERROR: No DB URI'); process.exit(1); }

    await mongoose.connect(uri);
    log(`Connected (${DRY_RUN ? 'DRY RUN' : 'LIVE'})`);

    const PublicAnimal = mongoose.model('PublicAnimal',
        new mongoose.Schema({}, { strict: false, collection: 'publicanimals' })
    );

    const missing = await PublicAnimal.countDocuments({ showOnPublicProfile: { $ne: true } });
    log(`Animals in PublicAnimal missing showOnPublicProfile:true — ${missing}`);

    if (missing === 0) {
        log('Nothing to fix.');
    } else if (DRY_RUN) {
        log('DRY RUN — no changes made.');
    } else {
        const result = await PublicAnimal.updateMany(
            { showOnPublicProfile: { $ne: true } },
            { $set: { showOnPublicProfile: true } }
        );
        log(`Updated ${result.modifiedCount} documents.`);
    }

    await mongoose.disconnect();
    log('Done.');
}

main().catch(err => { console.error(err); process.exit(1); });
