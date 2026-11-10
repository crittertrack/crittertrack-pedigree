'use strict';
const c = require('./ctx');
const { P, table, s, uniq, short, users, animals, publicAnimals, publicProfiles, info, F, path, hashesBefore, ids, knownOidCollection, animalByPub, userByPub } = c;

P('# CritterTrack Backup Cross-Reference Report');
P();
P(`Generated: ${new Date().toISOString()}  `);
P(`Source: backup \`${c.ID}\` (four primary files + backup-info). **Read-only analysis; no database or backup file was modified.**`);
P();
P('## 0. Evidence integrity (SHA-256 taken before reading)');
P();
table(['File', 'Bytes', 'SHA-256 (before)', 'Last modified'], Object.entries(hashesBefore).map(([k, h]) => [path.basename(F[k]), h.bytes, h.sha256, h.mtime]));

P('## 1. backup-info metadata vs actual file contents');
P();
const actual = { users: users.length, animals: animals.length, publicProfiles: publicProfiles.length, publicAnimals: publicAnimals.length };
table(['Collection', 'backup-info stats', 'Actual in file', 'Match'], Object.keys(actual).map(k => [k, info.stats[k], actual[k], info.stats[k] === actual[k] ? 'yes' : 'NO']));
const sumBytes = ['users', 'animals', 'publicAnimals', 'publicProfiles'].reduce((a, k) => a + hashesBefore[k].bytes, 0);
P(`- backup-info \`totalSizeBytes\` = ${info.totalSizeBytes}; the four files on disk total ${sumBytes} bytes (difference ${sumBytes - info.totalSizeBytes}${sumBytes === info.totalSizeBytes ? ': exact match, so the files are complete as exported' : ': does not match; investigate'}).`);
P(`- backup-info \`collections\` lists only: ${info.collections.join(', ')}. It carries **no** counts, ids or hints for any other collection, so litters/transactions/etc. were never exported by the scheduler (not a partial failure).`);
P(`- \`createdAt\` ${info.createdAt}; \`createdBy\` ${info.createdBy}; \`storageLocation\` "${info.storageLocation}" (an R2 copy, possibly with other collections, may exist; see recommendations).`);
P();

// ---- generic reference catalogue ----
const OID = /^[0-9a-f]{24}$/i;
const PUBEXACT = /^CT[A-Z]{1,2}\d+$/;
const PUBTEXT = /\b(CT[A-Z]{1,2})(\d{1,7})\b/g;
const oidCat = {}, pubCat = {}, textCat = {};
const walk = (v, p, cb) => {
    if (Array.isArray(v)) { v.forEach(x => walk(x, p + '[]', cb)); return; }
    if (v && typeof v === 'object') { for (const [k, x] of Object.entries(v)) walk(x, p ? p + '.' + k : k, cb); return; }
    cb(p, v);
};
const add = (cat, key, val, sample) => { const e = cat[key] || (cat[key] = { n: 0, set: new Set(), sample }); e.n++; e.set.add(val); };
for (const [file, docs] of [['users', users], ['animals', animals], ['publicAnimals', publicAnimals], ['publicProfiles', publicProfiles]]) {
    for (const d of docs) {
        walk(d, '', (p, v) => {
            if (typeof v !== 'string') return;
            if (OID.test(v) && p !== '_id' && !/\._id$|\[\]\._id$/.test(p)) add(oidCat, file + '::' + p, v, v);
            if (PUBEXACT.test(v)) add(pubCat, file + '::' + p, v, v);
            else {
                let m; PUBTEXT.lastIndex = 0;
                while ((m = PUBTEXT.exec(v))) add(textCat, file + '::' + p + '::' + m[1], m[1] + m[2], short(v, 110));
            }
        });
    }
}
P('## 2. Every ObjectId-valued reference field (excluding each document\'s own `_id`)');
P();
P('"Resolves to" = the ObjectId exists as an `_id` in one of the four backed-up collections. **NOT IN BACKUP** = it points to a collection that was not backed up (a reference to a missing record, not recoverable record data).');
P();
table(['File', 'Field path', 'Occurrences', 'Unique refs', 'Example', 'Resolves to (unique refs)'],
    Object.entries(oidCat).sort().map(([k, v]) => {
        const [file, p] = k.split('::'); const res = {};
        [...v.set].forEach(x => { const r = knownOidCollection(x); const key = r.length ? r.join('+') : 'NOT IN BACKUP'; res[key] = (res[key] || 0) + 1; });
        return [file, '`' + p + '`', v.n, v.set.size, v.sample, Object.entries(res).map(([a, b]) => `${a}: ${b}`).join('; ')];
    }));

P('## 3. Public-ID references (CTU / CTC / CTL / other CT-prefixed)');
P();
table(['File', 'Field path', 'Prefix', 'Occurrences', 'Unique', 'Example', 'Resolves to (unique)'],
    Object.entries(pubCat).sort().map(([k, v]) => {
        const [file, p] = k.split('::'); const res = { u: 0, a: 0, m: 0 };
        [...v.set].forEach(x => { if (userByPub.has(x)) res.u++; else if (animalByPub.has(x)) res.a++; else res.m++; });
        return [file, '`' + p + '`', uniq([...v.set].map(x => x.match(/^CT[A-Z]{1,2}/)[0])).join(','), v.n, v.set.size, v.sample, `users:${res.u} animals:${res.a} not-in-backup:${res.m}`];
    }));
P('Public-ID patterns embedded inside free text:');
P();
const textRows = Object.entries(textCat).sort().map(([k, v]) => { const [file, p, pre] = k.split('::'); return [file, '`' + p + '`', pre, v.n, v.set.size, v.sample]; });
table(['File', 'Field', 'Prefix', 'Hits', 'Unique', 'Sample text'], textRows.length ? textRows : [['-', '-', '-', 0, 0, 'none']]);
const ctl = uniq([...Object.values(pubCat), ...Object.values(textCat)].flatMap(v => [...v.set]).filter(x => /^CTL/.test(x)));
P(`**CTL (litter public-ID) values found anywhere in the four files: ${ctl.length} unique**${ctl.length ? ': ' + ctl.slice(0, 12).join(', ') : ''}`);
P();
c.shared.ctl = ctl;
