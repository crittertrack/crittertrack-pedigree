'use strict';
/** READ-ONLY scan of the 11-10 backup (part A): offspring CTL + planned matings. No DB access. */
const fs = require('fs');
const P = (k) => JSON.parse(fs.readFileSync(`C:/Projects/backups_auto-backup-2026-11-10T03-00-00_${k}.json`, 'utf8'));
const animals = P('animals'), users = P('users');
const uniq = (a) => [...new Set(a)];
const has = (v) => v !== null && v !== undefined && v !== '' && v !== false && !(Array.isArray(v) && !v.length);

console.log('=== A. OFFSPRING <-> CTL ===');
console.log('animal fields mentioning litter:', uniq(animals.flatMap(a => Object.keys(a)).filter(k => /litter/i.test(k))).join(', '));
console.log('sample animals.litterId:', animals.filter(a => a.litterId).slice(0, 1).map(a => a.litterId).join());

console.log('\n=== B. PLANNED MATINGS ===');
const planned = animals.filter(a => a.isPlannedMating);
console.log('isPlannedMating=true:', planned.length, '| isInMating:', animals.filter(a => a.isInMating).length, '| isPregnant:', animals.filter(a => a.isPregnant).length);
console.log('planned by gender:', JSON.stringify(planned.reduce((c, a) => { c[a.gender] = (c[a.gender] || 0) + 1; return c; }, {})));
['expectedDueDate', 'lastMatingDate', 'lastPregnancyDate', 'ovulationDate', 'lastHeatDate', 'heatStatus', 'breedingRole', 'litterCount', 'gestationLength', 'breedingRecords', 'breedingRestrictions', 'availableForBreeding', 'tags']
    .forEach(k => console.log('  planned animals with', k.padEnd(22), planned.filter(a => has(a[k])).length));
const byOwner = new Map(); planned.forEach(a => { const k = String(a.creatorId_public); if (!byOwner.has(k)) byOwner.set(k, []); byOwner.get(k).push(a); });
let both = 0; for (const [, v] of byOwner) if (v.some(a => a.gender === 'Male') && v.some(a => a.gender === 'Female')) both++;
console.log('  owners with planned animals:', byOwner.size, '| owners with both a planned male and female:', both);
console.log('  sample:', JSON.stringify(planned.slice(0, 3).map(a => ({ id: a.id_public, g: a.gender, sp: a.species, owner: a.creatorId_public, inMating: a.isInMating, due: a.expectedDueDate, lastMating: a.lastMatingDate, tags: a.tags, brec: (a.breedingRecords || []).length }))));
const mated = animals.filter(a => a.isInMating);
console.log('  isInMating:', mated.length, '| also planned:', mated.filter(a => a.isPlannedMating).length);
console.log('  users with breedingLineDefs:', users.filter(u => (u.breedingLineDefs || []).length).length, '| animalBreedingLines entries:', users.reduce((n, u) => n + Object.keys(u.animalBreedingLines || {}).length, 0));
const recWithPlanned = animals.flatMap(a => (a.breedingRecords || []).map(r => ({ a, r }))).filter(x => !x.r.birthEventDate);
console.log('  breedingRecords without a birth (planned/pending style):', recWithPlanned.length, '| sample:', JSON.stringify(recWithPlanned.slice(0, 2).map(x => ({ id: x.a.id_public, mate: x.r.mateAnimalId || x.r.mate, mating: x.r.matingDate, outcome: x.r.outcome }))));
