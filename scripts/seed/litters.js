'use strict';
/**
 * litters: rebuilt from animals.litterId groups (exact litter _id kept, so existing animal links work again).
 * Only fields that are directly evidenced are set. litter_id_public (CTL) is OMITTED (unknown; it is a
 * unique sparse index so storing null would collide). Counts reflect surviving/recorded offspring only.
 * --include-stubs also creates empty placeholder litters for ids that appear only in users.ownedLitters.
 */
module.exports = async (L, ctx) => {
    const { Litter } = L.models;
    const { animals, users } = ctx;
    const userByOid = new Map(users.map(u => [String(u._id), u]));
    const animalByPub = new Map(animals.map(a => [String(a.id_public), a]));
    const owners = new Map();
    users.forEach(u => (u.ownedLitters || []).forEach(l => { const k = String(l); if (!owners.has(k)) owners.set(k, []); owners.get(k).push(String(u._id)); }));

    const groups = new Map();
    animals.filter(a => a.litterId).forEach(a => { const k = String(a.litterId); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(a); });

    const label = (a) => (a ? [a.prefix, a.name].filter(Boolean).join(' ').trim() || null : null);
    const mode = (arr) => { const c = {}; arr.forEach(x => { c[x] = (c[x] || 0) + 1; }); return (Object.entries(c).sort((a, b) => b[1] - a[1])[0] || [])[0]; };
    const docs = [];
    for (const [lid, mem] of groups) {
        const creator = mode(mem.map(a => String(a.creatorId)));
        if (!userByOid.has(creator)) continue;
        const sire = mode(mem.map(a => a.sireId_public).filter(Boolean)) || null;
        const dam = mode(mem.map(a => a.damId_public).filter(Boolean)) || null;
        const birth = mode(mem.map(a => L.day(a.birthDate)).filter(Boolean));
        const g = (x) => mem.filter(a => String(a.gender || '').toLowerCase() === x).length;
        const male = g('male'), female = g('female');
        const created = mem.map(a => a.createdAt).filter(Boolean).sort()[0];
        const doc = {
            _id: L.oid(lid),
            creatorId: L.oid(creator),
            linkedOwners: (owners.get(lid) || []).filter(o => o !== creator).map(L.oid),
            sireId_public: sire, sirePrefixName: label(animalByPub.get(sire)),
            damId_public: dam, damPrefixName: label(animalByPub.get(dam)),
            birthDate: birth ? new Date(birth) : null,
            offspringIds_public: mem.map(a => a.id_public),
            maleCount: male, femaleCount: female, unknownCount: mem.length - male - female,
            breedingMethod: 'Unknown', outcome: birth ? 'Successful' : 'Unknown',
            isPlanned: false, birthDateUnknown: !birth,
            notes: 'Reconstructed from backup data after database loss; mating date, counts of born/stillborn/lost and notes were not recoverable.',
            createdAt: created ? new Date(created) : new Date(), updatedAt: new Date(), __v: 0,
        };
        docs.push(doc);
    }
    L.log(`  litters rebuilt from animal.litterId groups: ${docs.length} (offspring linked: ${docs.reduce((n, d) => n + d.offspringIds_public.length, 0)})`);
    let stubs = [];
    if (process.argv.includes('--include-stubs')) {
        const have = new Set(docs.map(d => String(d._id)));
        for (const [lid, own] of owners) {
            if (have.has(lid) || !userByOid.has(own[0])) continue;
            stubs.push({ _id: L.oid(lid), creatorId: L.oid(own[0]), linkedOwners: own.slice(1).map(L.oid), offspringIds_public: [], isPlanned: false,
                notes: 'Placeholder recreated from the owner\'s litter list after database loss; details were not recoverable.', createdAt: new Date(), updatedAt: new Date(), __v: 0 });
        }
        L.log(`  placeholder litters (owner list only): ${stubs.length}`);
    } else {
        L.log(`  (skipping ${[...owners.keys()].filter(k => !groups.has(k)).length} owner-list-only litter ids; use --include-stubs to add empty placeholders)`);
    }
    await L.insertMissing(Litter, docs.concat(stubs), (d) => ({ _id: d._id }), 'litters');
};
