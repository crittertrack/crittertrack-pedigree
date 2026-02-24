/**
 * Migration: Set birthDate to today for all animals missing a birth date.
 *
 * Usage:
 *   node migrate-missing-birthdates.js           # live run
 *   node migrate-missing-birthdates.js --dry-run  # preview only, no writes
 *
 * Affects both the Animal (private) and PublicAnimal (public mirror) collections.
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { Animal, PublicAnimal } = require('./database/models');

const DRY_RUN = process.argv.includes('--dry-run');
const TODAY = new Date();
TODAY.setUTCHours(0, 0, 0, 0); // Midnight UTC so it stores cleanly

async function run() {
    const MONGODB_URI = process.env.MONGODB_URI;
    if (!MONGODB_URI) {
        console.error('❌  MONGODB_URI not found in environment variables.');
        process.exit(1);
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log('  Migrate Missing BirthDates');
    console.log(`  Mode : ${DRY_RUN ? 'DRY RUN (no writes)' : '*** LIVE RUN ***'}`);
    console.log(`  Date : ${TODAY.toISOString().substring(0, 10)}`);
    console.log(`${'='.repeat(60)}\n`);

    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected.\n');

    // Query for documents where birthDate is null, undefined, or empty string
    const missingFilter = {
        $or: [
            { birthDate: null },
            { birthDate: { $exists: false } },
            { birthDate: '' }
        ]
    };

    // -------------------------------------------------------------------------
    // Animal collection (private/owned)
    // -------------------------------------------------------------------------
    const privateAnimals = await Animal.find(missingFilter)
        .select('id_public name species birthDate')
        .lean();

    console.log(`Found ${privateAnimals.length} Animal document(s) with missing birthDate.`);

    if (privateAnimals.length > 0) {
        console.log('\nAnimals to update:');
        privateAnimals.forEach(a => {
            console.log(`  [${a.id_public || a._id}] ${a.name || '(unnamed)'} (${a.species || 'unknown species'}) — birthDate: ${a.birthDate ?? 'null'}`);
        });

        if (!DRY_RUN) {
            const privateResult = await Animal.updateMany(missingFilter, {
                $set: { birthDate: TODAY }
            });
            console.log(`\n✅  Animal: updated ${privateResult.modifiedCount} document(s).`);
        }
    }

    // -------------------------------------------------------------------------
    // PublicAnimal collection (public mirror)
    // -------------------------------------------------------------------------
    const publicAnimals = await PublicAnimal.find(missingFilter)
        .select('id_public name species birthDate')
        .lean();

    console.log(`\nFound ${publicAnimals.length} PublicAnimal document(s) with missing birthDate.`);

    if (publicAnimals.length > 0) {
        console.log('\nPublic animals to update:');
        publicAnimals.forEach(a => {
            console.log(`  [${a.id_public || a._id}] ${a.name || '(unnamed)'} (${a.species || 'unknown species'}) — birthDate: ${a.birthDate ?? 'null'}`);
        });

        if (!DRY_RUN) {
            const publicResult = await PublicAnimal.updateMany(missingFilter, {
                $set: { birthDate: TODAY }
            });
            console.log(`\n✅  PublicAnimal: updated ${publicResult.modifiedCount} document(s).`);
        }
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
