'use strict';
/**
 * Shared context for the READ-ONLY backup cross-reference analysis.
 * Source files are only ever opened for reading; SHA-256 is recorded before and re-checked after.
 * No MongoDB connection is made anywhere in this analysis.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DIR = 'C:\\Projects';
const OUT = path.join(DIR, 'recovery-reports');
const ID = 'auto-backup-2026-11-10T03-00-00';
const F = {
    users: path.join(DIR, `backups_${ID}_users.json`),
    animals: path.join(DIR, `backups_${ID}_animals.json`),
    publicAnimals: path.join(DIR, `backups_${ID}_publicAnimals.json`),
    publicProfiles: path.join(DIR, `backups_${ID}_publicProfiles.json`),
    info: path.join(DIR, `backups_${ID}_backup-info.json`),
};
const sha = (p) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const hashesBefore = {};
for (const [k, p] of Object.entries(F)) {
    const st = fs.statSync(p);
    hashesBefore[k] = { sha256: sha(p), bytes: st.size, mtime: st.mtime.toISOString() };
}
const D = {};
for (const k of Object.keys(F)) D[k] = JSON.parse(fs.readFileSync(F[k], 'utf8'));

const s = (v) => (v === null || v === undefined ? '' : String(v));
const empty = (v) => v === null || v === undefined || v === '' ||
    (Array.isArray(v) && v.length === 0) ||
    (typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0);
const uniq = (a) => [...new Set(a)];
const short = (v, n = 90) => {
    if (v === undefined) return '';
    const t = typeof v === 'string' ? v : JSON.stringify(v);
    return t && t.length > n ? t.slice(0, n) + '…' : t;
};
const countBy = (arr) => { const c = {}; arr.forEach(x => { c[x] = (c[x] || 0) + 1; }); return c; };
const mode = (arr) => { const e = Object.entries(countBy(arr)).sort((a, b) => b[1] - a[1])[0]; return e ? e[0] : undefined; };
const dayKey = (d) => (d ? String(d).slice(0, 10) : '');

const md = [];
const P = (line = '') => { md.push(line); };
const table = (head, rows) => {
    P('| ' + head.join(' | ') + ' |');
    P('|' + head.map(() => '---').join('|') + '|');
    rows.forEach(r => P('| ' + r.map(c => s(c).replace(/\|/g, '\\|').replace(/\r?\n/g, ' ')).join(' | ') + ' |'));
    P();
};

const { users, animals, publicAnimals, publicProfiles, info } = D;
const ids = {
    users: new Set(users.map(u => s(u._id))),
    animals: new Set(animals.map(a => s(a._id))),
    publicProfiles: new Set(publicProfiles.map(p => s(p._id))),
    publicAnimals: new Set(publicAnimals.map(a => s(a._id))),
};
const knownOidCollection = (v) => Object.entries(ids).filter(([, set]) => set.has(v)).map(([k]) => k);
const animalByPub = new Map(animals.map(a => [s(a.id_public), a]));
const pubAnimalByPub = new Map(publicAnimals.map(a => [s(a.id_public), a]));
const userByPub = new Map(users.map(u => [s(u.id_public), u]));
const userByOid = new Map(users.map(u => [s(u._id), u]));

module.exports = {
    fs, path, DIR, OUT, ID, F, sha, hashesBefore, D, users, animals, publicAnimals, publicProfiles, info,
    s, empty, uniq, short, countBy, mode, dayKey, md, P, table, ids, knownOidCollection,
    animalByPub, pubAnimalByPub, userByPub, userByOid, shared: {},
};
