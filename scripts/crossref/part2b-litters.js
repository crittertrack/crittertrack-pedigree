'use strict';
const c = require('./ctx');
const { P, table, s, uniq, short, dayKey, empty, animals, ids, animalByPub } = c;
const { L } = c.shared;

P('### 4.3 `animals.breedingRecords[]` (embedded breeding snapshots incl. CTL link)');
P();
const recs = animals.flatMap(a => (a.breedingRecords || []).map(r => ({ a, r })));
P(`- Animals with embedded breedingRecords: **${animals.filter(a => (a.breedingRecords || []).length).length}**; total records: **${recs.length}**`);
const rf = (f) => recs.filter(x => !empty(x.r[f])).length;
table(['Record field', 'Non-empty records'], ['matingDate', 'mate', 'mateAnimalId', 'outcome', 'birthEventDate', 'litterSizeBorn', 'litterSizeWeaned', 'stillbornCount', 'lossesCount', 'litterId', 'notes', 'breedingMethod'].map(f => [f, rf(f)]));
const recCtl = recs.filter(x => x.r.litterId);
P(`- Records with a CTL \`litterId\`: **${recCtl.length}**; unique CTL ids: **${uniq(recCtl.map(x => x.r.litterId)).length}** ${uniq(recCtl.map(x => x.r.litterId)).slice(0, 8).join(', ')}`);
P(`- \`mateAnimalId\` resolving to a backed-up animal: ${recs.filter(x => x.r.mateAnimalId && (animalByPub.has(s(x.r.mateAnimalId)) || ids.animals.has(s(x.r.mateAnimalId)))).length} of ${rf('mateAnimalId')}`);
if (recs[0]) P(`- Example (${recs[0].a.id_public}): \`${short(recs[0].r, 400)}\``);
P();

for (const g of L) {
    for (const pid of [g.dam, g.sire].filter(Boolean)) {
        const p = animalByPub.get(pid); if (!p) continue;
        for (const r of (p.breedingRecords || [])) {
            const mateOk = r.mateAnimalId && [g.sire, g.dam].includes(s(r.mateAnimalId));
            const birthOk = r.birthEventDate && g.birth && Math.abs(new Date(r.birthEventDate) - new Date(g.birth)) <= 2 * 86400000;
            if (mateOk && (birthOk || (r.litterId && !g.birth))) { g.matched = r; g.mating = r.matingDate ? dayKey(r.matingDate) : null; g.ctl = r.litterId || null; break; }
        }
        if (g.matched) break;
    }
}
const unlinked = new Map();
animals.filter(a => !a.litterId && a.sireId_public && a.damId_public && a.birthDate).forEach(a => {
    const k = [a.sireId_public, a.damId_public, dayKey(a.birthDate), s(a.creatorId)].join('|');
    if (!unlinked.has(k)) unlinked.set(k, []); unlinked.get(k).push(a.id_public);
});
const unlinkedSets = [...unlinked.entries()].filter(([, v]) => v.length >= 2);
const matchedRecs = new Set(L.map(g => g.matched).filter(Boolean));

P('### 4.4 Reconstructable litters (independent sources combined)');
P();
const strong = L.filter(g => g.dam && g.sire && g.birth);
table(['Metric', 'Count'], [
    ['Litter ObjectIds recoverable from animal.litterId', L.length],
    ['...with sire + dam + birth date (strong partial recovery)', strong.length],
    ['...missing sire and/or dam and/or birth date (weak)', L.length - strong.length],
    ['...sire animal exists in backup', L.filter(g => g.sireExists).length],
    ['...dam animal exists in backup', L.filter(g => g.damExists).length],
    ['...creator user exists in backup', L.filter(g => g.creatorExists).length],
    ['...mating date recovered via parent breedingRecord match', L.filter(g => g.mating).length],
    ['...CTL id recovered via matched breedingRecord', L.filter(g => g.ctl).length],
    ['...an offspring has litterSizeBorn > 0', L.filter(g => g.born.length).length],
    ['...an offspring has litterSizeWeaned > 0', L.filter(g => g.weaned.length).length],
    ['...an offspring has stillbornCount > 0', L.filter(g => g.still.length).length],
    ['...an offspring has weaningDate', L.filter(g => g.weaningDates.length).length],
    ['...also listed in a user ownedLitters', L.filter(g => g.inOwned).length],
    ['Extra candidate litters with NO litterId (same sire+dam+birth day+owner, >=2 animals)', `${unlinkedSets.length} sets / ${unlinkedSets.reduce((a, [, v]) => a + v.length, 0)} animals`],
    ['Breeding records with birthEventDate not matched to a litter group', `${recs.filter(x => x.r.birthEventDate && !matchedRecs.has(x.r)).length} of ${recs.filter(x => x.r.birthEventDate).length}`],
]);
P('Example reconstructed litter payloads (derived, NOT written anywhere):');
P(); P('```json');
P(JSON.stringify(strong.slice(0, 2).map(g => ({ litterObjectId: g.lid, sire: g.sire, dam: g.dam, birth: g.birth, mating: g.mating, ctl: g.ctl, creator: g.creatorPub, offspring: g.offspring, genders: g.genders })), null, 1));
P('```'); P();
Object.assign(c.shared, { unlinkedSets, recs });
