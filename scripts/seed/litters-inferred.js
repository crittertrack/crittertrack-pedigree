'use strict';
/**
 * litters-inferred: litters for animals that have NO litterId but share the same sire + dam + birth day + owner
 * (>= 2 animals). Weaker evidence than litters-from-links, so each is clearly labelled as inferred.
 *  - INSERT-ONLY. Animals are NOT modified (their litterId stays null).
 *  - Deterministic _id (hash of the grouping key), so re-running never creates duplicates.
 *  - litter_id_public (CTL) omitted: unknown, and it is a unique sparse index.
 */
const crypto = require('crypto');

module.exports = async (L, ctx) => {
    const { Litter } = L.models;
    const { animals, users } = ctx;
    const userIds = new Set(users.map(u => String(u._id)));
    const animalByPub = new Map(animals.map(a => [String(a.id_public), a]));
    const label = (a) => (a ? [a.prefix, a.name].filter(Boolean).join(' ').trim() || null : null);
    const mode = (arr) => { const c = {}; arr.forEach(x => { c[x] = (c[x] || 0) + 1; }); return (Object.entries(c).sort((a, b) => b[1] - a[1])[0] || [])[0]; };

    const groups = new Map();
    animals.filter(a => !a.litterId && a.sireId_public && a.damId_public && a.birthDate).forEach(a => {
        const key = [a.sireId_public, a.damId_public, L.day(a.birthDate), String(a.creatorId)].join('|');
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(a);
    });

    const docs = [];
    let skippedNoOwner = 0;
    for (const [key, mem] of groups) {
        if (mem.length < 2) continue;
        const creator = String(mem[0].creatorId);
        if (!userIds.has(creator)) { skippedNoOwner++; continue; }
        const [sire, dam, birth] = key.split('|');
        const id = crypto.createHash('sha1').update('inferred-litter:' + key).digest('hex').slice(0, 24);
        const g = (x) => mem.filter(a => String(a.gender || '').toLowerCase() === x).length;
        const male = g('male'), female = g('female');
        const created = mem.map(a => a.createdAt).filter(Boolean).sort()[0];
        docs.push({
            _id: L.oid(id),
            creatorId: L.oid(creator),
            linkedOwners: [],
            sireId_public: sire, sirePrefixName: label(animalByPub.get(sire)),
            damId_public: dam, damPrefixName: label(animalByPub.get(dam)),
            birthDate: new Date(birth),
            offspringIds_public: mem.map(a => a.id_public),
            maleCount: male, femaleCount: female, unknownCount: mem.length - male - female,
            breedingMethod: 'Unknown', outcome: 'Successful', isPlanned: false, birthDateUnknown: false,
            tags: ['reconstructed'],
            notes: 'Inferred after database loss: these animals share the same sire, dam, birth date and owner. Mating date, litter counts and notes were not recoverable.',
            createdAt: created ? new Date(created) : new Date(), updatedAt: new Date(), __v: 0,
        });
    }
    L.log(`  candidate groups: ${groups.size} (>=2 animals: ${docs.length + skippedNoOwner}); owner missing: ${skippedNoOwner}`);
    L.log(`  litters to create: ${docs.length}; offspring covered: ${docs.reduce((n, d) => n + d.offspringIds_public.length, 0)}`);
    const sizes = {}; docs.forEach(d => { sizes[d.offspringIds_public.length] = (sizes[d.offspringIds_public.length] || 0) + 1; });
    L.log('  litter size distribution (animals: litters): ' + Object.entries(sizes).sort((a, b) => a[0] - b[0]).map(([k, v]) => `${k}:${v}`).join(' '));
    await L.insertMissing(Litter, docs, (d) => ({ _id: d._id }), 'litters (inferred)');
};
