'use strict';
/** READ-ONLY scan (part C): can planned / mating / pregnant animals be paired unambiguously? What is in quarantineDetails? */
const fs = require('fs');
const P = (k) => JSON.parse(fs.readFileSync(`C:/Projects/backups_auto-backup-2026-11-10T03-00-00_${k}.json`, 'utf8'));
const animals = P('animals');
const uniq = (a) => [...new Set(a)];
const alive = (a) => !a.deceasedDate;

const analyse = (label, flagFn) => {
    const set = animals.filter(flagFn);
    const groups = new Map();
    set.forEach(a => { const k = a.creatorId_public + '|' + a.species; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(a); });
    let unambiguous = 0, ambiguous = 0, onlyOneSex = 0, unambAnimals = 0;
    const amb = [];
    for (const [k, g] of groups) {
        const m = g.filter(a => a.gender === 'Male'), f = g.filter(a => a.gender === 'Female');
        if (!m.length || !f.length) { onlyOneSex++; continue; }
        if (m.length === 1 && f.length === 1) { unambiguous++; unambAnimals += 2; } else { ambiguous++; amb.push(`${k} ${m.length}M/${f.length}F`); }
    }
    console.log(`${label}: animals ${set.length} | owner+species groups ${groups.size} | exactly 1M+1F (pairable): ${unambiguous} | several M/F (ambiguous): ${ambiguous} | only one sex flagged: ${onlyOneSex}`);
    if (amb.length) console.log('   ambiguous groups:', amb.join('; '));
    return groups;
};
const planned = analyse('PLANNED', a => a.isPlannedMating);
analyse('IN MATING', a => a.isInMating);
analyse('PREGNANT (dams only)', a => a.isPregnant);
console.log('planned groups detail:');
for (const [k, g] of planned) console.log('  ', k, g.map(a => `${a.id_public}${a.gender[0]}${alive(a) ? '' : '(dead)'}${a.breedingRole ? ':' + a.breedingRole : ''}`).join(' '));
console.log('\npregnant dams:', animals.filter(a => a.isPregnant).map(a => `${a.id_public}(${a.creatorId_public},${a.species},due ${a.expectedDueDate ? String(a.expectedDueDate).slice(0, 10) : '-'},lastMating ${a.lastMatingDate ? String(a.lastMatingDate).slice(0, 10) : '-'})`).join(' '));

console.log('\nquarantineDetails values (top):', JSON.stringify(Object.entries(animals.filter(a => a.enclosureId).reduce((c, a) => { const v = JSON.stringify(a.quarantineDetails); c[v] = (c[v] || 0) + 1; return c; }, {})).sort((a, b) => b[1] - a[1]).slice(0, 3)));
console.log('isQuarantine true among enclosure animals:', animals.filter(a => a.enclosureId && a.isQuarantine).length);
console.log('enclosureId all valid ObjectIds:', animals.filter(a => a.enclosureId).every(a => /^[0-9a-f]{24}$/i.test(a.enclosureId)));
console.log('animals with isInTreatment among enclosure animals:', animals.filter(a => a.enclosureId && a.isInTreatment).length, '| isNursing:', animals.filter(a => a.enclosureId && a.isNursing).length, '| isPregnant:', animals.filter(a => a.enclosureId && a.isPregnant).length);
const ownerOfEnc = new Map(); animals.filter(a => a.enclosureId).forEach(a => ownerOfEnc.set(a.enclosureId, a.creatorId_public));
console.log('animals per enclosure incl. deceased:', animals.filter(a => a.enclosureId && a.deceasedDate).length, 'deceased animals still pointing at an enclosure');
