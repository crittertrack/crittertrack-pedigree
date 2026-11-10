#!/usr/bin/env node
/**
 * Seeds collections that were NOT in the backups, from the best evidence available.
 * INSERT-ONLY: never updates or deletes anything; skips documents whose _id / unique key already exists.
 * DRY RUN by default; pass --confirm to write.
 *
 *   1. species              <- scripts/data-species-defaults.json (from git history, migrate-species.js)
 *                              + species names used by animals but missing from the defaults (non-default)
 *   2. carechecklisttemplates <- utils/defaultCareTemplates.js (same planner the admin endpoint uses)
 *   3. litters              <- animals.litterId groups in the 2026-11-10 backup (exact _id)
 *   4. transactions         <- animals with sale/purchase transaction ids + price + date (exact _id)
 */
'use strict';
const fs = require('fs');
const path = require('path');
// .env wins over any stale system-level MONGODB_URI (which still points at the old cluster)
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env'), override: true });
const mongoose = require('mongoose');
const models = require('../../database/models');
const { planDefaultTemplates } = require('../../utils/defaultCareTemplates');

const confirm = process.argv.includes('--confirm');
const BACKUP_DIR = process.env.BACKUP_DIR || 'C:\\Projects';
const BID = 'auto-backup-2026-11-10T03-00-00';
const load = (n) => JSON.parse(fs.readFileSync(path.join(BACKUP_DIR, `backups_${BID}_${n}.json`), 'utf8'));
const oid = (v) => (v ? new mongoose.Types.ObjectId(String(v)) : null);
const day = (d) => (d ? String(d).slice(0, 10) : '');
const log = (...a) => console.log(...a);

async function insertMissing(Model, docs, keyFn, label) {
    // keyFn: (doc) => filter that identifies an existing equivalent document
    let inserted = 0, skipped = 0, failed = 0;
    for (const d of docs) {
        try {
            const exists = await Model.collection.findOne(keyFn(d), { projection: { _id: 1 } });
            if (exists) { skipped++; continue; }
            if (confirm) await Model.collection.insertOne(d);
            inserted++;
        } catch (e) { failed++; log(`  ERROR ${label}: ${e.message}`); }
    }
    log(`  ${label}: ${confirm ? 'inserted' : 'would insert'} ${inserted}, skipped (already exist) ${skipped}, errors ${failed}`);
    return { inserted, skipped, failed };
}

module.exports = { confirm, load, oid, day, log, insertMissing, models, mongoose, planDefaultTemplates, path, fs };
