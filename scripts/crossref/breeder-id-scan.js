'use strict';
/** READ-ONLY: what is breederAssignedId, and does it group animals the same way (or better than) sire+dam+birth day? */
const fs = require('fs');
const animals = JSON.parse(fs.readFileSync('C:/Projects/backups_auto-backup-2026-11-10T03-00-00_animals.json', 'utf8'));
const day = (d) => (d ? String(d).slice(0, 10) : '');
const uniq = (a) => [...new Set(a)];
const withId = animals.filter(a => a.breederAssignedId && String(a.breederAssignedId).trim());
console.log('animals with breederAssignedId:', withId.length, 'of', animals.length, '| owners:', uniq(withId.map(a => a.creatorId_public)).length);
console.log('unique values:', uniq(withId.map(a => a.breederAssignedId)).length, '| duplicates within an owner:', withId.length - uniq(withId.map(a => a.creatorId + '|' + a.breederAssignedId)).length);

// Show the shapes per owner (random samples) so we can see how people label litters
const byOwner = new Map(); withId.forEach(a => { if (!byOwner.has(a.creatorId_public)) byOwner.set(a.creatorId_public, []); byOwner.get(a.creatorId_public).push(a); });
const top = [...byOwner.entries()].sort((a, b) => b[1].length - a[1].length).slice(0, 8);
for (const [o, g] of top) console.log(' ', o, g.length, 'animals e.g.', g.slice(0, 8).map(a => a.breederAssignedId).join(' | '));

// Candidate "litter key" = the id with trailing sex/number tokens removed. Try several normalisations.
const keyOf = (s) => String(s).trim().replace(/[\s._-]*(?:[MFmf]|male|female|boy|girl|pup|kit|baby)?[\s._-]*\d*$/i, '').replace(/[\s._-]+$/, '');
const sample = withId.slice(0, 2000).map(a => [a.breederAssignedId, keyOf(a.breederAssignedId)]);
console.log('\nsample id -> key:', sample.filter((_, i) => i % 250 === 0).map(x => x.join(' => ')).join(' ; '));

// How do breeder-id keys line up with sire+dam+birth-day groups?
const groups = new Map();
animals.filter(a => a.sireId_public && a.damId_public && a.birthDate).forEach(a => {
    const k = [a.creatorId, a.sireId_public, a.damId_public, day(a.birthDate)].join('|'); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(a);
});
const multi = [...groups.values()].filter(g => g.length >= 2);
let withIds = 0, agree = 0, conflicting = 0; const conflictEx = [];
for (const g of multi) {
    const keys = g.map(a => a.breederAssignedId ? keyOf(a.breederAssignedId) : null).filter(Boolean);
    if (keys.length < 2) continue; withIds++;
    if (uniq(keys).length === 1) agree++; else { conflicting++; if (conflictEx.length < 6) conflictEx.push(g.map(a => a.breederAssignedId).join(' / ')); }
}
console.log('\nsire+dam+birthday groups (>=2 animals):', multi.length, '| with >=2 breeder ids:', withIds, '| all share one key:', agree, '| mixed keys:', conflicting);
console.log('mixed-key examples (possible two litters on one day, or just different naming):', conflictEx.join('  ||  '));

// Big groups (possible merged litters) - do breeder ids split them?
const big = multi.filter(g => g.length >= 12).sort((a, b) => b.length - a.length).slice(0, 6);
for (const g of big) console.log('big group', g[0].creatorId_public, g[0].sireId_public + 'x' + g[0].damId_public, day(g[0].birthDate), g.length, 'animals; keys:', JSON.stringify(Object.entries(g.reduce((c, a) => { const k = a.breederAssignedId ? keyOf(a.breederAssignedId) : '(none)'; c[k] = (c[k] || 0) + 1; return c; }, {})).slice(0, 6)));

// Animals the current rebuild does NOT cover: no litterId, and not in a >=2 sire+dam+birthday group
const inMulti = new Set(multi.flat().map(a => a.id_public));
const uncovered = animals.filter(a => !a.litterId && !inMulti.has(a.id_public));
const unc = uncovered.filter(a => a.breederAssignedId);
console.log('\nanimals with no litter at all after my rebuild:', uncovered.length, '| of those with a breederAssignedId:', unc.length);
console.log('  of those, missing sire/dam/birthDate:', unc.filter(a => !a.sireId_public || !a.damId_public || !a.birthDate).length);
const ukeys = new Map(); unc.forEach(a => { const k = a.creatorId + '|' + keyOf(a.breederAssignedId); if (!ukeys.has(k)) ukeys.set(k, []); ukeys.get(k).push(a); });
const ug = [...ukeys.values()].filter(g => g.length >= 2);
console.log('  breeder-id key groups of >=2 among them:', ug.length, 'covering', ug.reduce((n, g) => n + g.length, 0), 'animals');
console.log('  examples:', ug.slice(0, 6).map(g => `${g[0].creatorId_public}:${g.map(a => a.breederAssignedId).join(',')}`).join(' ; '));
