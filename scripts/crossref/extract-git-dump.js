#!/usr/bin/env node
'use strict';
/**
 * READ-ONLY: extracts the mongodump that was once committed to git (commit 1822c87,
 * backups/backup-2025-12-09T22-23-37) and decodes BSON -> JSON into C:\Projects\recovery-reports\git-dump-2025-12-09.
 * Does not modify the repo or connect to MongoDB.
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { BSON } = require('bson');

const REPO = 'C:\\Projects\\crittertrack-pedigree';
const COMMIT = '1822c87';
const BASE = 'backups/backup-2025-12-09T22-23-37/crittertrackdb/';
const OUT = 'C:\\Projects\\recovery-reports\\git-dump-2025-12-09';
fs.mkdirSync(OUT, { recursive: true });

for (const n of ['animals', 'counters', 'geneticsfeedbacks', 'litters', 'publicanimals', 'publicprofiles', 'species', 'users']) {
    const buf = execFileSync('git', ['show', `${COMMIT}:${BASE}${n}.bson`], { cwd: REPO, maxBuffer: 1 << 28 });
    fs.writeFileSync(path.join(OUT, n + '.bson'), buf);
    const docs = [];
    for (let o = 0; o < buf.length;) { const l = buf.readInt32LE(o); docs.push(BSON.deserialize(buf.subarray(o, o + l))); o += l; }
    fs.writeFileSync(path.join(OUT, n + '.json'), JSON.stringify(docs, (k, v) => v, 1));
    console.log(n.padEnd(20), buf.length, 'bytes', docs.length, 'docs');
}
