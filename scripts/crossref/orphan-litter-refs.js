'use strict';
/** READ-ONLY: does ANY source reference the 1,169 ownedLitters ids that have no litter record? No DB access. */
const fs = require('fs');
const D = 'C:/Projects/';
const P = (k) => JSON.parse(fs.readFileSync(`${D}backups_auto-backup-2026-11-10T03-00-00_${k}.json`, 'utf8'));
const users = P('users'), animals = P('animals'), pub = P('publicAnimals'), profiles = P('publicProfiles');

// Litter ids now covered by rebuilt litters = ids referenced by animals.litterId (99). The rest are the orphans.
const owned = new Set(); users.forEach(u => (u.ownedLitters || []).forEach(l => owned.add(String(l))));
const linked = new Set(animals.filter(a => a.litterId).map(a => String(a.litterId)));
const orphans = new Set([...owned].filter(id => !linked.has(id)));
console.log('ownedLitters ids:', owned.size, '| referenced by an animal.litterId:', owned.size - orphans.size, '| orphans:', orphans.size);

const hits = (label, text) => { let n = 0; const found = new Set(); for (const id of orphans) if (text.includes(id)) { n++; found.add(id); } console.log(label.padEnd(58), n); return found; };
const J = (x) => JSON.stringify(x);
hits('animals (11-10 backup), whole-document text search', J(animals));
hits('publicAnimals (11-10 backup)', J(pub));
hits('publicProfiles (11-10 backup)', J(profiles));
hits('users OTHER than ownedLitters (strip that field first)', J(users.map(u => { const c = { ...u }; delete c.ownedLitters; return c; })));

// older backups: 11-02 and 11-03 contain the same 4 collections
for (const f of ['auto-backup-2026-11-02T03-00-00.json', 'auto-backup-2026-11-03T03-00-00.json']) {
    const b = JSON.parse(fs.readFileSync(D + f, 'utf8'));
    const ownedOld = new Set(); (b.users || []).forEach(u => (u.ownedLitters || []).forEach(l => ownedOld.add(String(l))));
    const linkedOld = new Set((b.animals || []).filter(a => a.litterId).map(a => String(a.litterId)));
    const referencedOld = [...orphans].filter(id => linkedOld.has(id));
    console.log(`${f}: animals with litterId -> ${linkedOld.size} ids | of those, orphan ids: ${referencedOld.length} | ownedLitters ids: ${ownedOld.size} | orphans also owned there: ${[...orphans].filter(id => ownedOld.has(id)).length}`);
    const extra = hits(`  ${f} animals text search`, J(b.animals || []));
}
// pre-restore snapshot
try {
    const snap = JSON.parse(fs.readFileSync(D + 'pre-restore-snapshot-1793752772870.json', 'utf8'));
    hits('pre-restore-snapshot (animals + publicAnimals)', J(snap));
} catch (e) { console.log('snapshot not readable:', e.message); }

// Different angle: animals that SHOULD belong to a litter but have no litterId (the 889 inferred sets + planned flags), for owners with orphans
const orphanOwners = new Set(); users.forEach(u => (u.ownedLitters || []).forEach(l => { if (orphans.has(String(l))) orphanOwners.add(String(u._id)); }));
const noLink = animals.filter(a => !a.litterId && a.sireId_public && a.damId_public && orphanOwners.has(String(a.creatorId)));
console.log('\nanimals of owners-with-orphans that have sire+dam but NO litterId:', noLink.length);
const per = {}; users.forEach(u => { const n = (u.ownedLitters || []).filter(l => orphans.has(String(l))).length; if (n) per[u.id_public] = { orphanLitters: n, animalsWithParentsNoLitter: animals.filter(a => String(a.creatorId) === String(u._id) && !a.litterId && a.sireId_public && a.damId_public).length }; });
console.log('top owners (orphan litters vs unlinked animals that have parents):', J(Object.entries(per).sort((a, b) => b[1].orphanLitters - a[1].orphanLitters).slice(0, 6)));
