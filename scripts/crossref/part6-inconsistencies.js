'use strict';
const c = require('./ctx');
const { P, table, s, uniq, short, users, animals, publicAnimals, publicProfiles, ids, animalByPub, pubAnimalByPub, userByPub, userByOid } = c;

P('## 10. Inconsistencies between the four backup files');
P();
const profByUser = new Map(publicProfiles.map(p => [s(p.userId_backend), p]));
const usersNoProfile = users.filter(u => !profByUser.has(s(u._id)));
const profNoUser = publicProfiles.filter(p => !ids.users.has(s(p.userId_backend)));
const shared = ['id_public', 'breederName', 'personalName', 'showBreederName', 'showPersonalName', 'websiteURL', 'profileImage', 'breedingStatus', 'showEmailPublic', 'bio', 'showBio'];
const pd = {}; let pairs = 0;
users.forEach(u => { const p = profByUser.get(s(u._id)); if (!p) return; pairs++; shared.forEach(k => { if (k in u && k in p && JSON.stringify(u[k]) !== JSON.stringify(p[k])) pd[k] = (pd[k] || 0) + 1; }); });

const pubOnly = publicAnimals.filter(p => !animalByPub.has(s(p.id_public)));
const displayNoPub = animals.filter(a => a.isDisplay && !pubAnimalByPub.has(s(a.id_public)));
const pubNotDisplay = animals.filter(a => !a.isDisplay && pubAnimalByPub.has(s(a.id_public)));
const cmp = ['name', 'species', 'gender', 'birthDate', 'sireId_public', 'damId_public', 'litterId', 'status', 'color', 'geneticCode', 'creatorId', 'creatorId_public', 'breederId_public', 'ownerId_public', 'isOwned', 'deceasedDate', 'enclosureId', 'isForSale', 'salePriceAmount', 'soldStatus', 'imageUrl'];
const ad = {}, ex = {}; let apairs = 0;
animals.forEach(a => {
    const p = pubAnimalByPub.get(s(a.id_public)); if (!p) return; apairs++;
    cmp.forEach(k => {
        if (k in a && k in p && JSON.stringify(a[k] === undefined ? null : a[k]) !== JSON.stringify(p[k] === undefined ? null : p[k])) {
            ad[k] = (ad[k] || 0) + 1; if (!ex[k]) ex[k] = `${a.id_public}: ${short(a[k], 30)} vs ${short(p[k], 30)}`;
        }
    });
});
const idDiff = animals.filter(a => { const p = pubAnimalByPub.get(s(a.id_public)); return p && s(p._id) !== s(a._id); }).length;
const ownedMismatch = users.filter(u => (u.ownedAnimals || []).length && (u.ownedAnimals || []).length !== animals.filter(a => s(a.creatorId) === s(u._id)).length);
const ownedMissing = users.reduce((n, u) => n + (u.ownedAnimals || []).filter(x => !ids.animals.has(s(x))).length, 0);
const creatorPubBad = animals.filter(a => a.creatorId_public && userByOid.get(s(a.creatorId)) && userByOid.get(s(a.creatorId)).id_public !== a.creatorId_public);
const sireMissing = animals.filter(a => a.sireId_public && !animalByPub.has(s(a.sireId_public)));
const damMissing = animals.filter(a => a.damId_public && !animalByPub.has(s(a.damId_public)));
const dupPub = (arr) => arr.length - uniq(arr.map(x => s(x.id_public))).length;
const blockedMissing = users.reduce((n, u) => n + (u.blockedUsers || []).filter(x => !ids.users.has(s(x)) && !userByPub.has(s(x))).length, 0);

table(['Check', 'Result'], [
    ['Users without a publicProfile', `${usersNoProfile.length} (e.g. ${usersNoProfile.slice(0, 5).map(u => u.id_public).join(', ')}); users 173 vs profiles 170`],
    ['publicProfiles without a user', profNoUser.length],
    [`User<->profile shared fields that differ (of ${pairs} pairs)`, JSON.stringify(pd)],
    ['publicAnimals whose id_public is not in animals (orphans)', `${pubOnly.length} ${pubOnly.slice(0, 5).map(p => p.id_public).join(',')}`],
    ['animals with isDisplay=true but no publicAnimal', displayNoPub.length],
    ['animals with isDisplay=false but a publicAnimal exists', pubNotDisplay.length],
    [`animal vs publicAnimal differing fields (of ${apairs} pairs)`, JSON.stringify(ad)],
    ['  example differences', JSON.stringify(ex)],
    ['animal & publicAnimal share the same _id', `${apairs - idDiff} same, ${idDiff} different`],
    ['users where ownedAnimals length != animals with that creatorId', `${ownedMismatch.length} of ${users.filter(u => (u.ownedAnimals || []).length).length} users with ownedAnimals`],
    ['users.ownedAnimals entries pointing at animals not in backup', ownedMissing],
    ['animals.creatorId_public inconsistent with users.id_public', creatorPubBad.length],
    ['animals whose sire is not in animals', `${sireMissing.length} (unique ${uniq(sireMissing.map(a => a.sireId_public)).length})`],
    ['animals whose dam is not in animals', `${damMissing.length} (unique ${uniq(damMissing.map(a => a.damId_public)).length})`],
    ['duplicate id_public in animals / publicAnimals / users', `${dupPub(animals)} / ${dupPub(publicAnimals)} / ${dupPub(users)}`],
    ['users.blockedUsers references missing', blockedMissing],
    ['animals.creatorId pointing at users not in backup', animals.filter(a => !ids.users.has(s(a.creatorId))).length],
    ['animals.originalCreatorId pointing at users not in backup', animals.filter(a => a.originalCreatorId && !ids.users.has(s(a.originalCreatorId))).length],
]);
const dang = uniq([...sireMissing.map(a => a.sireId_public), ...damMissing.map(a => a.damId_public)]);
P(`- Unique dangling parent ids: **${dang.length}**; found in publicAnimals: ${dang.filter(x => pubAnimalByPub.has(x)).length}; found nowhere: ${dang.filter(x => !pubAnimalByPub.has(x) && !animalByPub.has(x)).length}. Examples: ${dang.slice(0, 10).join(', ') || 'none'}. These identify deleted animals or animals of deleted accounts.`);
P();
