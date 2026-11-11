'use strict';
/** READ-ONLY: how well do breederAssignedId litter codes line up with the rebuilt litters? */
const fs = require('fs');
const P = (k) => JSON.parse(fs.readFileSync(`C:/Projects/backups_auto-backup-2026-11-10T03-00-00_${k}.json`, 'utf8'));
const animals = P('animals'), users = P('users');
const day = (d) => (d ? String(d).slice(0, 10) : '');
const uniq = (a) => [...new Set(a)];
const keyOf = (s) => String(s).trim().replace(/[\s._-]*(?:[MFmf]|male|female|boy|girl|pup|kit|baby)?[\s._-]*\d*$/i, '').replace(/[\s._-]+$/, '');
const userBy = new Map(users.map(u => [String(u._id), u]));

// the two litter sources I built: exact-link groups and sire+dam+birthday groups
const groups = new Map();
animals.forEach(a => {
    let k = null;
    if (a.litterId) k = 'L:' + a.litterId;
    else if (a.sireId_public && a.damId_public && a.birthDate) k = ['I', a.creatorId, a.sireId_public, a.damId_public, day(a.birthDate)].join('|');
    if (!k) return; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(a);
});
const litters = [...groups.values()].filter(g => g.length >= 2 || g[0].litterId);
console.log('rebuilt litter groups:', litters.length);

let nameable = 0, partial = 0, none = 0, clean = 0;
const examples = [];
for (const g of litters) {
    const keys = g.map(a => a.breederAssignedId ? keyOf(a.breederAssignedId) : null);
    const have = keys.filter(Boolean);
    if (!have.length) { none++; continue; }
    const top = Object.entries(have.reduce((c, k) => { c[k] = (c[k] || 0) + 1; return c; }, {})).sort((a, b) => b[1] - a[1])[0];
    const share = top[1] / g.length;
    if (top[1] === g.length) { clean++; nameable++; } else if (share >= 0.6 && top[0].length >= 2) { partial++; nameable++; }
    if (examples.length < 6 && top[1] >= 3) examples.push(`${g[0].creatorId_public}:${top[0]} (${top[1]}/${g.length})`);
}
console.log('litters whose animals ALL share one breeder code:', clean, '| majority (>=60%) share one:', partial, '| nameable total:', nameable, '| no breeder ids at all:', none);
console.log('examples:', examples.join(' ; '));

// Distinct litter codes per owner vs (rebuilt litters + orphan ownedLitters) per owner
console.log('\nper owner: distinct litter codes in breeder ids | rebuilt litters | orphan ownedLitters');
const linked = new Set(animals.filter(a => a.litterId).map(a => String(a.litterId)));
const rows = [];
for (const [o, u] of [...userBy.entries()]) {
    const mine = animals.filter(a => String(a.creatorId) === o && a.breederAssignedId);
    if (mine.length < 40) continue;
    const codes = uniq(mine.map(a => keyOf(a.breederAssignedId))).length;
    const rebuilt = litters.filter(g => String(g[0].creatorId) === o).length;
    const orphan = (u.ownedLitters || []).filter(l => !linked.has(String(l))).length;
    rows.push([u.id_public, mine.length, codes, rebuilt, orphan]);
}
rows.sort((a, b) => b[1] - a[1]).slice(0, 8).forEach(r => console.log(' ', r[0], '| animals with code', r[1], '| distinct codes', r[2], '| rebuilt litters', r[3], '| orphan ids', r[4]));

// Codes shared by animals with DIFFERENT sire/dam/birthday (i.e. my grouping would split one real litter)
let splits = 0, splitAnimals = 0; const splitEx = [];
const byCode = new Map(); animals.filter(a => a.breederAssignedId).forEach(a => { const k = a.creatorId + '|' + keyOf(a.breederAssignedId); if (keyOf(a.breederAssignedId).length < 2) return; if (!byCode.has(k)) byCode.set(k, []); byCode.get(k).push(a); });
for (const [k, g] of byCode) {
    if (g.length < 2) continue;
    const sig = uniq(g.map(a => [a.sireId_public, a.damId_public, day(a.birthDate)].join('|')));
    if (sig.length > 1) { splits++; splitAnimals += g.length; if (splitEx.length < 5) splitEx.push(`${g[0].creatorId_public}:${k.split('|')[1]} -> ${sig.length} different parent/birth combos (${g.length} animals)`); }
}
console.log('\nbreeder codes spanning MORE than one sire/dam/birth combination:', splits, 'codes,', splitAnimals, 'animals');
console.log('examples:', splitEx.join(' ; '));
