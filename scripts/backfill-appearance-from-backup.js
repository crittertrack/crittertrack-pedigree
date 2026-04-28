/**
 * Backfill appearance + genetic fields from an April 22 backup JSON
 * into any animals that currently have those fields empty/null in the DB.
 *
 * Run with --dry-run to preview without writing.
 * Run without flag to apply changes.
 */

const mongoose = require('mongoose');
const fs = require('fs');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const BACKUP_PATH = 'C:\\Users\\dbana\\Downloads\\auto-backup-2026-04-22T03-00-00.json';

const APPEARANCE_FIELDS = [
    'color', 'coat', 'coatPattern', 'geneticCode',
    'phenotype', 'morph', 'markings', 'eyeColor',
    'nailColor', 'size', 'carrierTraits', 'earset',
    'strain', 'breed'
];

const isDryRun = process.argv.includes('--dry-run');

async function main() {
    console.log(`Mode: ${isDryRun ? 'DRY RUN (no writes)' : 'LIVE (will write to DB)'}`);

    const backup = JSON.parse(fs.readFileSync(BACKUP_PATH, 'utf8'));
    const backupAnimals = backup.animals || [];
    console.log(`Backup has ${backupAnimals.length} animals`);

    // Build a map of id_public -> backup record (only those with at least one appearance field)
    const backupMap = new Map();
    for (const a of backupAnimals) {
        const hasData = APPEARANCE_FIELDS.some(f => a[f] && a[f].toString().trim() !== '');
        if (hasData) backupMap.set(a.id_public, a);
    }
    console.log(`Backup animals with at least one appearance field: ${backupMap.size}`);

    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.db;
    const col = db.collection('animals');

    // Fetch all animals whose id_public is in the backup map
    const ids = [...backupMap.keys()];
    const dbAnimals = await col.find({ id_public: { $in: ids } }).toArray();
    console.log(`Found ${dbAnimals.length} matching animals in DB`);

    let updateCount = 0;
    let skipCount = 0;

    for (const dbAnimal of dbAnimals) {
        const bk = backupMap.get(dbAnimal.id_public);
        const patch = {};

        for (const f of APPEARANCE_FIELDS) {
            const dbVal = dbAnimal[f];
            const bkVal = bk[f];
            const dbEmpty = !dbVal || dbVal.toString().trim() === '';
            const bkHasData = bkVal && bkVal.toString().trim() !== '';
            if (dbEmpty && bkHasData) {
                patch[f] = bkVal;
            }
        }

        if (Object.keys(patch).length === 0) {
            skipCount++;
            continue;
        }

        const patchDesc = Object.entries(patch).map(([k, v]) => `${k}="${v}"`).join(', ');
        console.log(`  [${dbAnimal.id_public}] ${dbAnimal.name}: ${patchDesc}`);

        if (!isDryRun) {
            await col.updateOne({ _id: dbAnimal._id }, { $set: patch });
            // Also sync to PublicAnimal if it exists
            await db.collection('publicanimals').updateOne(
                { id_public: dbAnimal.id_public },
                { $set: patch }
            );
        }
        updateCount++;
    }

    console.log(`\nSummary: ${updateCount} animals ${isDryRun ? 'would be' : 'were'} updated, ${skipCount} skipped (already had data)`);
    await mongoose.disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
