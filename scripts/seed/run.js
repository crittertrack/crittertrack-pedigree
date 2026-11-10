#!/usr/bin/env node
/**
 * Seeds data that was missing from the backups. INSERT-ONLY. DRY RUN unless --confirm.
 * Usage: node scripts/seed/run.js [--confirm] [--only=species,care,litters,transactions]
 * Backup source dir: BACKUP_DIR (default C:\Projects; the ORIGINAL 11-10 files are only read).
 */
'use strict';
const L = require('./lib');
const { mongoose, log, confirm } = L;

const only = (process.argv.find(a => a.startsWith('--only=')) || '').replace('--only=', '').split(',').filter(Boolean);
const want = (n) => !only.length || only.includes(n);

(async () => {
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error('MONGODB_URI missing');
    log(`\nMode: ${confirm ? 'LIVE WRITE (insert-only)' : 'DRY RUN'}  Target: ${uri.replace(/\/\/[^@]+@/, '//***:***@')}`);
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 20000 });
    log('Database:', mongoose.connection.name, '\n');
    const ctx = { animals: L.load('animals'), users: L.load('users') };
    const steps = [['species', './species'], ['care', './care'], ['litters', './litters'], ['transactions', './transactions'], ['litters-inferred', './litters-inferred'], ['planned', './planned-litters'], ['enclosures', './enclosures'], ['waitlists', './waitlists']];
    for (const [name, file] of steps) {
        if (!want(name)) continue;
        log(`=== ${name} ===`);
        await require(file)(L, ctx);
        log('');
    }
    await mongoose.disconnect();
    log(confirm ? 'Done (written).' : 'Dry run complete - nothing was written. Re-run with --confirm.');
})().catch(e => { console.error('FATAL', e); process.exit(1); });
