'use strict';
const c = require('./ctx');
const { P, table, s, uniq, short, countBy, mode, dayKey, users, animals, ids, knownOidCollection, animalByPub } = c;

P('## 4. Litter reconstruction analysis');
P();
const withLitter = animals.filter(a => a.litterId);
const groups = new Map();
withLitter.forEach(a => { const k = s(a.litterId); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(a); });

P('### 4.1 `animals.litterId` (ObjectId -> `litters._id`)');
P();
P(`- Animals with non-null \`litterId\`: **${withLitter.length}** of ${animals.length}`);
P(`- Unique litter ObjectIds: **${groups.size}**`);
P(`- Resolving to a restored record: **${[...groups.keys()].filter(k => knownOidCollection(k).length).length}** (litter documents lived only in the missing \`litters\` collection: these are references, not data)`);
P(`- Example: animal \`${withLitter[0].id_public}\` -> litterId \`${withLitter[0].litterId}\``);
P(`- publicAnimals litter-related keys: ${uniq(c.publicAnimals.flatMap(a => Object.keys(a)).filter(k => /litter/i.test(k))).join(', ') || 'none'} (publicAnimals with litterId: ${c.publicAnimals.filter(a => a.litterId).length})`);
P(`- Offspring-per-litter distribution: ${Object.entries(countBy([...groups.values()].map(g => g.length))).sort((a, b) => a[0] - b[0]).map(([k, v]) => `${k} animal(s): ${v}`).join(', ')}`);
P();

const L = [];
const conf = { sire: 0, dam: 0, birth: 0, creator: 0, species: 0 };
const confEx = [];
for (const [lid, mem] of groups) {
    const sires = uniq(mem.map(a => s(a.sireId_public)).filter(Boolean));
    const dams = uniq(mem.map(a => s(a.damId_public)).filter(Boolean));
    const births = mem.map(a => dayKey(a.birthDate)).filter(Boolean);
    const creators = uniq(mem.map(a => s(a.creatorId)));
    const species = uniq(mem.map(a => s(a.species)));
    if (sires.length > 1) conf.sire++;
    if (dams.length > 1) conf.dam++;
    if (uniq(births).length > 1) conf.birth++;
    if (creators.length > 1) conf.creator++;
    if (species.length > 1) conf.species++;
    if ((sires.length > 1 || dams.length > 1 || uniq(births).length > 1 || creators.length > 1) && confEx.length < 4) confEx.push({ lid, sires, dams, births: uniq(births), creators: creators.length });
    const pos = (f) => mem.map(a => a[f]).filter(v => typeof v === 'number' && v > 0);
    L.push({
        lid, n: mem.length, sire: sires[0] || null, dam: dams[0] || null, birth: mode(births) || null,
        creatorId: mode(mem.map(a => s(a.creatorId))), creatorPub: mode(mem.map(a => s(a.creatorId_public))), species: species[0],
        genders: countBy(mem.map(a => s(a.gender) || 'Unknown')), offspring: mem.map(a => a.id_public),
        born: pos('litterSizeBorn'), weaned: pos('litterSizeWeaned'), still: pos('stillbornCount'),
        weaningDates: uniq(mem.map(a => dayKey(a.weaningDate)).filter(Boolean)),
        sireExists: sires[0] ? animalByPub.has(sires[0]) : false, damExists: dams[0] ? animalByPub.has(dams[0]) : false,
        creatorExists: ids.users.has(mode(mem.map(a => s(a.creatorId)))),
        inOwned: false, mating: null, ctl: null, matched: null,
    });
}
P('**Internal consistency of litter groups (inconsistencies among offspring of the same litterId):**');
P();
table(['Check', 'Groups affected'], [
    ['Offspring disagree on sire', conf.sire], ['Offspring disagree on dam', conf.dam], ['Offspring disagree on birth day', conf.birth],
    ['Offspring have different creators', conf.creator], ['Offspring of different species', conf.species],
]);
if (confEx.length) P('Examples: `' + short(confEx, 500) + '`\n');

const ownedLit = new Map();
users.forEach(u => (u.ownedLitters || []).forEach(l => { const k = s(l); if (!ownedLit.has(k)) ownedLit.set(k, []); ownedLit.get(k).push(s(u.id_public)); }));
L.forEach(g => { g.inOwned = ownedLit.has(g.lid); });
const ownedOrphans = [...ownedLit.keys()].filter(k => !groups.has(k));
P('### 4.2 `users.ownedLitters` (array of litter ObjectIds)');
P();
P(`- Users with non-empty \`ownedLitters\`: **${users.filter(u => (u.ownedLitters || []).length).length}** of ${users.length}; total entries ${[...ownedLit.values()].reduce((a, b) => a + b.length, 0)}; unique litter ObjectIds **${ownedLit.size}**`);
P(`- Also referenced by some animal.litterId: ${ownedLit.size - ownedOrphans.length}; **only in ownedLitters (no recorded offspring): ${ownedOrphans.length}**`);
P(`- Litter groups from animal.litterId that appear in NO user's ownedLitters: ${L.filter(g => !g.inOwned).length} (ownedLitters is an incomplete index; the two sources complement each other)`);
if (ownedOrphans[0]) P(`- Example orphan: litter \`${ownedOrphans[0]}\` owned by ${ownedLit.get(ownedOrphans[0]).join(',')} (only id + owner recoverable).`);
P();

Object.assign(c.shared, { L, ownedOrphans, ownedLit, groups });
