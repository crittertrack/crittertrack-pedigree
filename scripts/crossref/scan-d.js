'use strict';
/** READ-ONLY scan (part D): contacts, appearance options, transfers, supplies, public-animal gaps. No DB access. */
const fs = require('fs');
const P = (k) => JSON.parse(fs.readFileSync(`C:/Projects/backups_auto-backup-2026-11-10T03-00-00_${k}.json`, 'utf8'));
const animals = P('animals'), pub = P('publicAnimals'), users = P('users');
const uniq = (a) => [...new Set(a)];
const norm = (s) => String(s || '').trim().replace(/\s+/g, ' ');
const userByPub = new Map(users.map(u => [u.id_public, u]));

console.log('=== CONTACTS (people recorded on animals) ===');
const people = new Map(); // owner|name(lower) -> {roles, animals, linked}
const add = (owner, name, role, a, linked) => {
    name = norm(name); if (!name) return;
    const k = owner + '|' + name.toLowerCase(); const p = people.get(k) || { owner, name, roles: new Set(), animals: new Set(), linked: null };
    p.roles.add(role); p.animals.add(a.id_public); if (linked) p.linked = linked; people.set(k, p);
};
for (const a of animals) {
    const o = String(a.creatorId);
    add(o, a.manualBreederName, 'breeder', a);
    add(o, a.manualownerName, 'keeper', a);
    (a.keeperHistory || []).forEach(h => add(o, h.name, 'keeper', a, h.userId_public));
    (a.ownershipHistory || []).forEach(h => add(o, h.ownerName, 'keeper', a, h.userId_public));
}
const arr = [...people.values()];
console.log('distinct (owner, person) pairs:', arr.length, '| owners:', uniq(arr.map(p => p.owner)).length);
console.log('by role: breeder', arr.filter(p => p.roles.has('breeder')).length, '| keeper', arr.filter(p => p.roles.has('keeper')).length, '| both', arr.filter(p => p.roles.size > 1).length);
console.log('with a linked CTU id:', arr.filter(p => p.linked).length, '| top owners:', JSON.stringify(Object.entries(arr.reduce((c, p) => { const u = users.find(x => String(x._id) === p.owner); const k = u ? u.id_public : '?'; c[k] = (c[k] || 0) + 1; return c; }, {})).sort((a, b) => b[1] - a[1]).slice(0, 6)));
console.log('sample:', JSON.stringify(arr.slice(0, 4).map(p => [p.name, [...p.roles].join('/'), p.animals.size])));
const linkedAnimals = animals.filter(a => a.breederId_public && a.breederId_public !== a.creatorId_public);
console.log('animals bred by ANOTHER registered user (contact link via linkedCTUID, no free text):', linkedAnimals.length, '| distinct (owner, breeder CTU):', uniq(linkedAnimals.map(a => a.creatorId_public + '>' + a.breederId_public)).length);
console.log('buyer/seller free text on animals: sellerName', animals.filter(a => a.sellerName).length, '| buyerName', animals.filter(a => a.buyerName).length, '| reservedBuyerName', animals.filter(a => a.reservedBuyerName).length);

console.log('\n=== APPEARANCE OPTIONS (dropdown values users typed) ===');
const F = ['color', 'markings', 'earset', 'coat', 'eyeColor', 'carrierTraits', 'body'];
const opts = new Map();
for (const a of animals) for (const f of F) { const v = norm(a[f]); if (!v) continue; opts.set([a.creatorId, a.species, f, v.toLowerCase()].join('|'), 1); }
console.log('distinct (owner, species, field, value):', opts.size, '| by field:', JSON.stringify(F.reduce((c, f) => { c[f] = [...opts.keys()].filter(k => k.split('|')[2] === f).length; return c; }, {})));
console.log('owners with options:', uniq([...opts.keys()].map(k => k.split('|')[0])).length);

console.log('\n=== TRANSFERS ===');
const pend = animals.filter(a => a.pendingTransferId);
console.log('pending transfer animals:', pend.length);
pend.forEach(a => console.log('  ', a.id_public, '| owner', a.creatorId_public, '| ownerId_public', a.ownerId_public, '| original', (users.find(u => String(u._id) === String(a.originalCreatorId)) || {}).id_public, '| viewOnly', (a.viewOnlyForUsers || []).map(x => (users.find(u => String(u._id) === String(x)) || {}).id_public).join(','), '| reserved', a.reservedBuyerName, '| transferId', a.pendingTransferId));
const changed = animals.filter(a => a.originalCreatorId && String(a.originalCreatorId) !== String(a.creatorId));
console.log('animals that changed hands (originalCreatorId != creatorId):', changed.length, '| with soldStatus sold:', changed.filter(a => a.soldStatus === 'sold').length, '| viewOnly includes original owner:', changed.filter(a => (a.viewOnlyForUsers || []).map(String).includes(String(a.originalCreatorId))).length);
console.log('distinct from>to pairs:', uniq(changed.map(a => a.originalCreatorId + '>' + a.creatorId)).length);

console.log('\n=== SUPPLIES ===');
const ds = animals.filter(a => (a.dietSupplies || []).length || (a.supplementSupplies || []).length);
console.log('animals with dietSupplies/supplementSupplies:', ds.length, '| distinct (owner,name):', uniq(ds.flatMap(a => [...(a.dietSupplies || []), ...(a.supplementSupplies || [])].map(s => a.creatorId + '|' + norm(s.name).toLowerCase()))).length);
console.log('sample:', JSON.stringify(ds.slice(0, 2).map(a => [a.id_public, a.dietSupplies, a.supplementSupplies])));

console.log('\n=== PUBLIC ANIMAL GAPS ===');
const pubIds = new Set(pub.map(a => a.id_public));
const gap = animals.filter(a => a.isDisplay && !pubIds.has(a.id_public));
console.log('animals isDisplay=true without a publicAnimal:', gap.length, '| by owner:', JSON.stringify(gap.reduce((c, a) => { c[a.creatorId_public] = (c[a.creatorId_public] || 0) + 1; return c; }, {})), '| deceased:', gap.filter(a => a.deceasedDate).length);
console.log('newest created among gap:', gap.map(a => String(a.createdAt).slice(0, 10)).sort().slice(-3).join(','), '| backup newest animal:', animals.map(a => String(a.createdAt).slice(0, 10)).sort().pop());
