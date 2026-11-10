'use strict';
/**
 * waitlistentries: recreated from animals.reservedWaitlistEntryId (exact _id kept, so the reservations on the
 * animals attach to their entry again). Buyer name / contact come from the reserved* fields on the animals;
 * the entry date is the ObjectId's embedded creation time. What each person originally REQUESTED (amounts per
 * species) is not stored anywhere, so speciesRequests reflects the animals currently assigned (a minimum).
 * Prices/deposits stay on the animals (that is where the app reads them).
 */
module.exports = async (L, ctx) => {
    const { WaitlistEntry } = L.models;
    const userIds = new Set(ctx.users.map(u => String(u._id)));
    const groups = new Map();
    ctx.animals.filter(a => a.reservedWaitlistEntryId).forEach(a => {
        const k = String(a.reservedWaitlistEntryId); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(a);
    });
    const docs = []; let noOwner = 0;
    let order = 0;
    for (const [id, animals] of [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
        const owner = L.mode(animals.map(a => String(a.creatorId)));
        if (!userIds.has(owner)) { noOwner++; continue; }
        const name = L.mode(animals.map(a => (a.reservedBuyerName || '').trim()).filter(Boolean)) || 'Unknown (recovered)';
        const contact = L.mode(animals.map(a => (a.reservedBuyerContact || '').trim()).filter(Boolean)) || '';
        const bySpecies = new Map();
        animals.forEach(a => {
            const sp = a.species || ''; if (!bySpecies.has(sp)) bySpecies.set(sp, { Male: 0, Female: 0, Any: 0 });
            const g = a.gender === 'Male' || a.gender === 'Female' ? a.gender : 'Any'; bySpecies.get(sp)[g]++;
        });
        const speciesRequests = [...bySpecies.entries()].map(([species, c]) => {
            const genderCounts = ['Male', 'Female', 'Any'].filter(g => c[g] > 0).map(g => ({ gender: g, count: c[g] }));
            return { species, genders: genderCounts.map(x => x.gender), genderCounts, amount: genderCounts.reduce((n, x) => n + x.count, 0) };
        });
        const first = speciesRequests[0];
        docs.push({
            _id: L.oid(id), userId: L.oid(owner), name, contactInfo: contact, contactId: null, contactName: '',
            speciesRequests, species: first.species, genders: first.genders, amount: first.amount,
            notes: 'Recreated after a database loss from the reservations on the assigned animals. The original request details and any notes were not recovered.',
            isActive: true, assignedAnimals: [], finalizedAt: null, entryDate: L.idTime(id), sortOrder: ++order,
            createdAt: L.idTime(id), updatedAt: new Date(), __v: 0,
        });
    }
    L.log(`  waitlist entries: ${groups.size} | to create: ${docs.length} | owner not found: ${noOwner}`);
    docs.forEach(d => L.log(`    ${String(d._id).slice(-6)} | ${d.name} | ${d.contactInfo || '(no contact)'} | ${d.speciesRequests.map(r => r.species + ' ' + r.genderCounts.map(g => g.count + g.gender[0]).join('/')).join(', ')} | ${d.entryDate.toISOString().slice(0, 10)}`));
    await L.insertByIds(WaitlistEntry, docs, 'waitlistentries');
};
