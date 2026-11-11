'use strict';
/**
 * contacts: the people each user recorded on their animals, rebuilt as Contact records so the Contacts page works again.
 * Sources (all per owner): manualBreederName (breeder), manualownerName and keeperHistory/ownershipHistory names (keeper),
 * and registered breeders (animals bred by ANOTHER CritterTrack user -> a contact linked by linkedCTUID, no free text needed).
 * The app finds a contact's animals by linkedCTUID (breeder/owner id) or by assignedAnimals, so we fill assignedAnimals for
 * free-text people. Names are kept exactly as typed ("Tebbe Bonder (Bonder Exotics)"). Phone/address/notes were never stored.
 * Insert-only; deterministic _id per (owner, person) so re-running never duplicates.
 */
const crypto = require('crypto');
const norm = (s) => String(s || '').trim().replace(/\s+/g, ' ');

module.exports = async (L, ctx) => {
    const Contact = require('../../database/contactModel');
    const userByPub = new Map(ctx.users.map(u => [u.id_public, u]));
    const userIds = new Set(ctx.users.map(u => String(u._id)));
    const people = new Map();
    const touch = (owner, name, ctu, role, a) => {
        name = norm(name); if (!name && !ctu) return;
        const key = owner + '|' + (ctu ? 'ctu:' + ctu : 'name:' + name.toLowerCase());
        const p = people.get(key) || { owner, name, ctu: ctu || null, roles: new Set(), animals: new Map() };
        p.roles.add(role); if (!p.name && name) p.name = name;
        const prev = p.animals.get(a.id_public);
        p.animals.set(a.id_public, { _id: a._id, role: prev && prev.role !== role ? 'both' : role });
        people.set(key, p);
    };
    for (const a of ctx.animals) {
        const owner = String(a.creatorId); if (!userIds.has(owner)) continue;
        if (a.breederId_public && a.breederId_public !== a.creatorId_public && userByPub.has(a.breederId_public)) touch(owner, '', a.breederId_public, 'breeder', a);
        else touch(owner, a.manualBreederName, null, 'breeder', a);
        if (a.ownerId_public && a.ownerId_public !== a.creatorId_public && userByPub.has(a.ownerId_public)) touch(owner, '', a.ownerId_public, 'keeper', a);
        else touch(owner, a.manualownerName, null, 'keeper', a);
        (a.keeperHistory || []).forEach(h => touch(owner, h.name, h.userId_public && userByPub.has(h.userId_public) ? h.userId_public : null, 'keeper', a));
        (a.ownershipHistory || []).forEach(h => touch(owner, h.ownerName, h.userId_public && userByPub.has(h.userId_public) ? h.userId_public : null, 'keeper', a));
    }
    const docs = [];
    for (const p of people.values()) {
        const linked = p.ctu ? userByPub.get(p.ctu) : null;
        const personal = linked ? (linked.personalName || null) : (p.name || null);
        const breeder = linked ? (linked.breederName || null) : null;
        if (!personal && !breeder) continue;
        const id = crypto.createHash('sha1').update('contact:' + p.owner + '|' + (p.ctu || p.name.toLowerCase())).digest('hex').slice(0, 24);
        const isBreeder = p.roles.has('breeder'), isKeeper = p.roles.has('keeper');
        docs.push({
            _id: L.oid(id), userId: L.oid(p.owner), linkedCTUID: p.ctu, personalName: personal, breederName: typeof breeder === 'string' ? breeder : null,
            prefix: null, suffix: null, address: {}, isKeeper, isBreeder, categories: [], breederStatus: 'active',
            assignedAnimals: p.ctu ? [] : [...p.animals.entries()].map(([pub, v]) => ({ animalId: v._id, animalId_public: pub, role: v.role, assignedDate: new Date() })),
            notes: 'Recreated after a database loss from the names recorded on your animals. Address, phone and notes were not recovered.',
            createdAt: new Date(), updatedAt: new Date(), __v: 0,
        });
    }
    const linkedN = docs.filter(d => d.linkedCTUID).length;
    L.log(`  distinct people: ${docs.length} (linked to a CritterTrack user: ${linkedN}, free-text: ${docs.length - linkedN}) | owners: ${new Set(docs.map(d => String(d.userId))).size}`);
    L.log(`  breeders: ${docs.filter(d => d.isBreeder).length} | keepers: ${docs.filter(d => d.isKeeper).length} | both: ${docs.filter(d => d.isBreeder && d.isKeeper).length}`);
    await L.insertByIds(Contact, docs, 'contacts');
};
