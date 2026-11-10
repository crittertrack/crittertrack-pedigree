'use strict';
const c = require('./ctx');
const { P, table, short, animals } = c;

P('Litter fields and how recoverable they are:');
P();
table(['Litter schema field', 'Source in backup', 'Recovery quality'], [
    ['_id', 'animals.litterId', 'EXACT (existing animal links would work again)'],
    ['creatorId', 'consensus of offspring creatorId; or ownedLitters owner', 'EXACT / near-exact'],
    ['sireId_public, damId_public', 'offspring sire/dam fields', 'EXACT when offspring agree'],
    ['birthDate', 'offspring birthDate (mode)', 'EXACT to the day'],
    ['offspringIds_public', 'animals sharing litterId', 'EXACT for animals still existing'],
    ['male/female/unknownCount', 'offspring gender', 'PARTIAL (survivors only; excludes stillborn/lost)'],
    ['litterSizeBorn/Weaned, stillbornCount, lossesCount', 'animal copies + parent breedingRecords', 'PARTIAL where non-zero'],
    ['matingDate, breedingMethod, outcome, notes', 'parent breedingRecords matched by mate + birth date', 'PARTIAL'],
    ['litter_id_public (CTL####)', 'breedingRecords[].litterId only', 'PARTIAL, mostly absent'],
    ['sirePrefixName / damPrefixName', 'derivable from sire/dam animal', 'DERIVABLE'],
    ['breedingPairCodeName, linkedOwners, weaningConfirmed, isPlanned, litter notes', 'none', 'NOT RECOVERABLE'],
    ['Planned/empty litters', 'users.ownedLitters (id only)', 'ID + owner only'],
]);

P('## 5. Animal-level litter/breeding echo fields');
P();
const meaningful = (v) => v !== null && v !== undefined && v !== '' && v !== 0 && v !== false && !(Array.isArray(v) && !v.length);
table(['animals field', 'Animals with value', 'Example'], ['litterSizeBorn', 'litterSizeWeaned', 'stillbornCount', 'litterCount', 'offspringCount', 'successfulMatings', 'lastMatingDate', 'lastPregnancyDate', 'expectedDueDate', 'nursingStartDate', 'weaningDate', 'gestationLength', 'isPregnant', 'isNursing', 'isInMating', 'isPlannedMating', 'deliveryMethod']
    .map(f => [f, animals.filter(a => meaningful(a[f])).length, short((animals.find(a => meaningful(a[f])) || {})[f], 40)]));
