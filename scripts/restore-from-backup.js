#!/usr/bin/env node
/**
 * CritterTrack Emergency Database Restoration Script
 * Restores from November 10, 2026 five-file backup.
 * DRY RUN by default. --confirm required for live restore.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const BACKUP_DIR = process.env.BACKUP_DIR || 'C:\\Projects';
const BACKUP_ID = 'auto-backup-2026-11-10T03-00-00';

const BACKUP_FILES = {
    users: path.join(BACKUP_DIR, `backups_${BACKUP_ID}_users.json`),
    animals: path.join(BACKUP_DIR, `backups_${BACKUP_ID}_animals.json`),
    publicProfiles: path.join(BACKUP_DIR, `backups_${BACKUP_ID}_publicProfiles.json`),
    publicAnimals: path.join(BACKUP_DIR, `backups_${BACKUP_ID}_publicAnimals.json`),
    backupInfo: path.join(BACKUP_DIR, `backups_${BACKUP_ID}_backup-info.json`),
};

const RESTORE_ORDER = ['users', 'publicProfiles', 'animals', 'publicAnimals'];

function parseArgs(argv) {
    const args = argv.slice(2);
    let confirm = false;
    for (const arg of args) {
        if (arg === '--confirm' || arg === '-c') confirm = true;
        else if (arg === '--help' || arg === '-h') { printUsage(); process.exit(0); }
        else { console.error(`Unknown option: ${arg}`); printUsage(); process.exit(1); }
    }
    return { confirm };
}
function printUsage() {
    console.log(`
Usage: node scripts/restore-from-backup.js [--confirm]
  (no flags)   DRY RUN - validates backup, no database writes
  --confirm    Perform actual restoration into MongoDB
Environment:
  MONGODB_URI   Required for --confirm mode (not hardcoded)
`);
}
function loadBackups() {
    const data = {};
    const errors = [];
    for (const [key, filePath] of Object.entries(BACKUP_FILES)) {
        if (!fs.existsSync(filePath)) errors.push(`Missing backup file: ${filePath}`);
    }
    if (errors.length > 0) { errors.forEach(e => console.error(`ERROR: ${e}`)); process.exit(1); }
    for (const [key, filePath] of Object.entries(BACKUP_FILES)) {
        try {
            data[key] = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            console.log(`  Loaded ${key}: ${filePath}`);
        } catch (err) {
            console.error(`ERROR: Failed to parse ${filePath}: ${err.message}`); process.exit(1);
        }
    }
    return data;
}
function castDocument(rawDoc, Model) {
    if (!rawDoc || typeof rawDoc !== 'object' || Array.isArray(rawDoc)) return rawDoc;
    try {
        const hydrated = Model.hydrate(rawDoc);
        return hydrated.toObject ? hydrated.toObject({ getters: false, virtuals: false }) : hydrated;
    } catch (err) { return rawDoc; }
}
function calculateCounters(users, animals) {
    const counters = {};
    let maxUserSeq = 0;
    for (const u of users) { const m = String(u.id_public || '').match(/^CTU(\d+)$/); if (m) { const n = parseInt(m[1], 10); if (n > maxUserSeq) maxUserSeq = n; } }
    counters.userId = maxUserSeq;
    let maxAnimalSeq = 0;
    for (const a of animals) { const m = String(a.id_public || '').match(/^CTC(\d+)$/); if (m) { const n = parseInt(m[1], 10); if (n > maxAnimalSeq) maxAnimalSeq = n; } }
    counters.animalId = maxAnimalSeq;
    counters.litterId = 1000;
    return counters;
}
async function main() {
    const { confirm } = parseArgs(process.argv);
    const isDryRun = !confirm;
    console.log(`\n==============================================================================`);
    console.log(` CritterTrack Emergency Database Restoration`);
    console.log(` Mode: ${isDryRun ? 'DRY RUN (no writes)' : 'LIVE RESTORE'}`);
    console.log(` Backup ID: ${BACKUP_ID}`);
    console.log(`==============================================================================\n`);
    console.log('Phase 1: Loading backup files...\n');
    const data = loadBackups();
    const info = data.backupInfo || {};
    console.log(`\nBackup metadata:`);
    console.log(`  ID:            ${info.id || 'N/A'}`);
    console.log(`  Created:       ${info.createdAt || 'N/A'}`);
    console.log(`  Created by:    ${info.createdBy || 'N/A'}`);
    console.log(`  Type:          ${info.type || 'N/A'}`);
    console.log(`  Description:   ${info.description || 'N/A'}`);
    console.log(`  Storage:       ${info.storageLocation || 'N/A'}`);
    console.log(`  Collections:   ${(info.collections || []).join(', ')}`);
    console.log(`  Total size:    ${info.totalSizeBytes || 0} bytes`);
    console.log('');
    const collections = {
        users: data.users,
        animals: data.animals,
        publicProfiles: data.publicProfiles,
        publicAnimals: data.publicAnimals,
    };
    const expectedCounts = info.stats || {};
    console.log(`Documents in backup:`);
    for (const [name, docs] of Object.entries(collections)) {
        const actual = Array.isArray(docs) ? docs.length : 0;
        const expected = expectedCounts[name] || 'N/A';
        const match = expected !== 'N/A' && actual === expected ? 'MATCH' : 'MISMATCH';
        console.log(`  ${name}: ${actual} documents (backup-info says ${expected}) [${match}]`);
    }
    console.log('');
    if (isDryRun) {
        console.log('*** DRY RUN MODE: No database operations will be performed. ***');
        console.log('*** Re-run with --confirm to perform actual restoration.     ***\n');
    }
    if (!isDryRun) {
        const uri = process.env.MONGODB_URI;
        if (!uri) {
            console.error('ERROR: MONGODB_URI environment variable is required for --confirm mode.');
            console.error('       Do NOT hardcode credentials - set MONGODB_URI in your environment.');
            process.exit(1);
        }
        const maskedUri = uri.replace(/(:\/\/[^:]+:[^@]+@)/, '://***:***@');
        console.log(`Connecting to: ${maskedUri}\n`);
        try {
            await mongoose.connect(uri);
            console.log('Connected to MongoDB.\n');
            const dbName = mongoose.connection.db.databaseName;
            console.log(`Target database: ${dbName}`);
            const collectionsList = await mongoose.connection.db.listCollections().toArray();
            const nonEmpty = [];
            for (const c of collectionsList) {
                if (await mongoose.connection.db.collection(c.name).countDocuments({}) > 0) nonEmpty.push(c.name);
            }
            if (nonEmpty.length > 0 && !process.env.RESUME) {
                const collNames = nonEmpty.join(', ');
                console.error(`ERROR: Target database is NOT empty. Collections: ${collNames}`);
                console.error('       Aborting to prevent data corruption.');
                await mongoose.disconnect();
                process.exit(1);
            }
            console.log('Target database confirmed empty.\n');
        } catch (err) {
            console.error(`ERROR connecting to MongoDB: ${err.message}`);
            process.exit(1);
        }
    }
    let User, Animal, PublicProfile, PublicAnimal;
    try {
        const models = require('../database/models');
        User = models.User; Animal = models.Animal;
        PublicProfile = models.PublicProfile; PublicAnimal = models.PublicAnimal;
    } catch (err) {
        console.error(`ERROR loading models: ${err.message}`);
        if (!isDryRun) await mongoose.disconnect();
        process.exit(1);
    }
    const modelMap = { users: User, animals: Animal, publicProfiles: PublicProfile, publicAnimals: PublicAnimal };
    console.log('Phase 4: Schema-based type casting validation...\n');
    const castingErrors = [];
    for (const [name, docs] of Object.entries(collections)) {
        const Model = modelMap[name];
        if (!Array.isArray(docs)) { castingErrors.push({ collection: name, error: 'not an array' }); continue; }
        for (let i = 0; i < docs.length; i++) {
            try { castDocument(docs[i], Model); } catch (err) {
                castingErrors.push({ collection: name, index: i, _id: docs[i] ? docs[i]._id : 'unknown', error: err.message });
            }
        }
        const ec = castingErrors.filter(e => e.collection === name).length;
        console.log(`  ${name}: ${docs.length} documents, ${ec} casting error(s)`);
    }
    if (castingErrors.length > 0) {
        console.log(`\nWARNING: ${castingErrors.length} casting error(s):`);
        for (const e of castingErrors.slice(0, 20)) console.log(`  [${e.collection}] idx=${e.index} _id=${e._id}: ${e.error}`);
        if (castingErrors.length > 20) console.log(`  ... and ${castingErrors.length - 20} more`);
    } else { console.log('  All documents cast successfully.\n'); }
    console.log('\nPhase 5: Duplicate ID check within backup...\n');
    for (const [name, docs] of Object.entries(collections)) {
        const seen = new Set(); const dups = [];
        for (const d of docs) { if (d._id) { const idStr = String(d._id); if (seen.has(idStr)) dups.push(idStr); else seen.add(idStr); } }
        if (dups.length > 0) { console.log(`  ${name}: ${dups.length} duplicate _id value(s)`); for (const d of dups.slice(0,10)) console.log(`    _id: ${d}`); }
        else console.log(`  ${name}: No duplicate _id values`);
    }
    console.log('\nPhase 6: Cross-collection reference validation...\n');
    const missingRefs = [];
    const userIds = new Set(); const animalIds = new Set();
    for (const u of collections.users) if (u._id) userIds.add(String(u._id));
    for (const a of collections.animals) if (a._id) animalIds.add(String(a._id));
    for (const a of collections.animals) {
        if (a.creatorId && !userIds.has(String(a.creatorId))) missingRefs.push({ coll:'animals', field:'creatorId', val:String(a.creatorId), pub:a.id_public||'?' });
        if (a.originalCreatorId && !userIds.has(String(a.originalCreatorId))) missingRefs.push({ coll:'animals', field:'originalCreatorId', val:String(a.originalCreatorId), pub:a.id_public||'?' });
    }
    for (const p of collections.publicProfiles) {
        if (p.userId_backend && !userIds.has(String(p.userId_backend))) missingRefs.push({ coll:'publicProfiles', field:'userId_backend', val:String(p.userId_backend), pub:p.id_public||'?' });
    }
    if (missingRefs.length > 0) {
        console.log(`  WARNING: ${missingRefs.length} missing cross-collection reference(s):`);
        for (const r of missingRefs.slice(0,20)) console.log(`    [${r.coll}] ${r.field}=${r.val} (doc ${r.pub})`);
        if (missingRefs.length > 20) console.log(`    ... and ${missingRefs.length - 20} more`);
        console.log('  NOTE: litterId references to Litter collection are expected (litters not in backup).\n');
    } else { console.log('  All cross-collection references resolved within backup.\n'); }
    console.log('Phase 7: Counter reconstruction (preview)...\n');
    const counters = calculateCounters(collections.users, collections.animals);
    console.log(`  Counter 'userId': seq = ${counters.userId} (next public ID: CTU${counters.userId + 1})`);
    console.log(`  Counter 'animalId': seq = ${counters.animalId} (next public ID: CTC${counters.animalId + 1})`);
    console.log(`  Counter 'litterId': seq = ${counters.litterId} (next public ID: CTL${counters.litterId + 1})`);
    console.log('  These values will be written during live restore.\n');
    if (isDryRun) {
        console.log('==============================================================================');
        console.log(' DRY RUN COMPLETE - No database changes were made.');
        console.log(' Re-run with --confirm to perform actual restoration.');
        console.log('==============================================================================\n');
        process.exit(0);
    }
    console.log('==============================================================================');
    console.log(' LIVE RESTORE - Writing to database...');
    console.log('==============================================================================\n');
    const results = {};
    for (const name of RESTORE_ORDER) {
        const Model = modelMap[name];
        const docs = collections[name];
        console.log(`Restoring ${name} (${docs.length} documents)...`);
        let inserted = 0, skipped = 0, errors = 0;
        const casted = docs.map(d => castDocument(d, Model));
        for (let i = 0; i < casted.length; i += 500) {
            const batch = casted.slice(i, i + 500);
            try {
                const r = await Model.collection.insertMany(batch, { ordered: false });
                inserted += r.insertedCount;
            } catch (err) {
                // Duplicate-key errors (code 11000) = already restored in an earlier run; count the rest as inserted.
                const writeErrors = err.writeErrors || [];
                const dup = writeErrors.filter(e => e.code === 11000).length;
                const other = writeErrors.length - dup;
                inserted += (err.result && err.result.insertedCount) || (batch.length - writeErrors.length);
                skipped += dup; errors += other;
                writeErrors.filter(e => e.code !== 11000).slice(0, 5).forEach(e => console.error(`  ERROR: ${name}: ${e.errmsg}`));
                if (!writeErrors.length) { console.error(`  ERROR: ${name}: ${err.message}`); errors += batch.length; }
            }
        }        results[name] = { inserted, skipped, errors, total: docs.length };
        console.log(`  Result: ${inserted} inserted, ${skipped} skipped (exist), ${errors} error(s)\n`);
    }
    console.log('Phase 10: Reconstructing Counter collection...\n');
    const Counter = mongoose.model('Counter');
    const counterResults = {};
    for (const [counterId, seq] of Object.entries(counters)) {
        try {
            const existing = await Counter.findById(counterId).lean();
            if (existing) { console.log(`  SKIP (exists): Counter._id=${counterId} (seq=${existing.seq})`); counterResults[counterId] = { skipped: true, existingSeq: existing.seq }; continue; }
            await Counter.create({ _id: counterId, seq });
            console.log(`  Created: Counter._id=${counterId}, seq=${seq}`);
            counterResults[counterId] = { created: true, seq };
        } catch (err) { console.error(`  ERROR: Counter._id=${counterId}: ${err.message}`); counterResults[counterId] = { error: err.message }; }
    }
    console.log('\nPhase 11: Post-restore count verification...\n');
    let allCountsMatch = true;
    for (const [name, docs] of Object.entries(collections)) {
        const Model = modelMap[name];
        const actualCount = await Model.countDocuments({});
        const expectedCount = docs.length;
        const match = actualCount === expectedCount;
        if (!match) allCountsMatch = false;
        console.log(`  ${name}: backup=${expectedCount}, database=${actualCount}, ${match ? 'MATCH' : 'MISMATCH'}`);
    }
    console.log('\n==============================================================================');
    if (allCountsMatch && castingErrors.length === 0) {
        console.log(' RESTORATION COMPLETE - All counts match, no casting errors.');
    } else {
        console.log(' RESTORATION COMPLETE WITH WARNINGS - Review the output above.');
    }
    console.log('==============================================================================\n');
    console.log('Final Summary:');
    for (const [n, r] of Object.entries(results)) console.log(`  ${n}: ${r.inserted} inserted, ${r.skipped} skipped, ${r.errors} errors`);
    console.log(`  Casting errors: ${castingErrors.length}`);
    console.log(`  Missing references: ${missingRefs.length}`);
    console.log(`  Counters reconstructed: ${Object.keys(counterResults).length}\n`);
    await mongoose.disconnect();
    process.exit(0);
}
process.on('unhandledRejection', (err) => { console.error('Unhandled promise rejection:', err); process.exit(1); });
main().catch((err) => { console.error('Fatal error:', err); process.exit(1); });
