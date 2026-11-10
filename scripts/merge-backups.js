#!/usr/bin/env node
/**
 * Merges the 2026-11-10 backup with records that exist only in the 2026-11-03 backup
 * (same _id missing from 11-10). Writes to C:\Projects\merged-backup (originals untouched).
 * Only adds records whose owner (creatorId) exists in the 11-10 users list.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const DIR = 'C:\\Projects';
const OUT = path.join(DIR, 'merged-backup');
const ID = 'auto-backup-2026-11-10T03-00-00';
const P = (k) => path.join(DIR, `backups_${ID}_${k}.json`);
const old = JSON.parse(fs.readFileSync(path.join(DIR, 'auto-backup-2026-11-03T03-00-00.json'), 'utf8'));

fs.mkdirSync(OUT, { recursive: true });
const users = JSON.parse(fs.readFileSync(P('users'), 'utf8'));
const userIds = new Set(users.map(u => String(u._id)));

const info = JSON.parse(fs.readFileSync(P('backup-info'), 'utf8'));
for (const k of ['users', 'animals', 'publicProfiles', 'publicAnimals']) {
    const cur = JSON.parse(fs.readFileSync(P(k), 'utf8'));
    const have = new Set(cur.map(d => String(d._id)));
    const extra = (old[k] || []).filter(d => !have.has(String(d._id)) &&
        (!d.creatorId || userIds.has(String(d.creatorId))) &&
        (!d.userId_backend || userIds.has(String(d.userId_backend))));
    const merged = cur.concat(extra);
    console.log(`${k}: ${cur.length} + ${extra.length} recovered = ${merged.length}`);
    info.stats[k] = merged.length;
    fs.writeFileSync(path.join(OUT, `backups_${ID}_${k}.json`), JSON.stringify(merged));
}
fs.writeFileSync(path.join(OUT, `backups_${ID}_backup-info.json`), JSON.stringify(info, null, 2));
console.log('Merged backup written to', OUT);
