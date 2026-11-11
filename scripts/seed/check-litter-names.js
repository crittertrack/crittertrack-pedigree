'use strict';
// READ-ONLY: for every litter, can each parent be resolved to a name the way the Overview page does it?
//   1) the litter owner's own animals (GET /animals)   2) public animals by id (GET /public/animals, isDisplay=true)
// Also checks litter fields the cards display (breedingPairCodeName, sire/dam prefix names).
const L = require('./lib');
(async () => {
    await L.mongoose.connect(process.env.MONGODB_URI);
    const d = L.mongoose.connection.db;
    const litters = await d.collection('litters').find({}).toArray();
    const animals = await d.collection('animals').find({}).project({ id_public: 1, name: 1, prefix: 1, suffix: 1, creatorId: 1, isDisplay: 1 }).toArray();
    const pub = new Set((await d.collection('publicanimals').find({ isDisplay: true }).project({ id_public: 1 }).toArray()).map(x => x.id_public));
    const byPub = new Map(animals.map(a => [a.id_public, a]));
    const stats = { total: litters.length, ownerHasBoth: 0, viaPublicOnly: 0, unresolvedSire: 0, unresolvedDam: 0, unresolvedEither: 0, noName: 0 };
    const bad = [];
    for (const l of litters) {
        const res = (id) => {
            const a = byPub.get(id); if (!a) return 'missing-animal';
            if (String(a.creatorId) === String(l.creatorId)) return 'own';
            return pub.has(id) ? 'public' : 'PRIVATE-OF-ANOTHER-USER';
        };
        const s = res(l.sireId_public), dm = res(l.damId_public);
        if (s === 'own' && dm === 'own') stats.ownerHasBoth++;
        else if ([s, dm].every(x => x === 'own' || x === 'public')) stats.viaPublicOnly++;
        if (!['own', 'public'].includes(s)) stats.unresolvedSire++;
        if (!['own', 'public'].includes(dm)) stats.unresolvedDam++;
        if (!['own', 'public'].includes(s) || !['own', 'public'].includes(dm)) { stats.unresolvedEither++; if (bad.length < 8) bad.push([l.litter_id_public, l.sireId_public + ':' + s, l.damId_public + ':' + dm, (l.tags || []).join()]); }
        const nm = (a) => a && (a.name || a.prefix || a.suffix);
        if (!nm(byPub.get(l.sireId_public)) || !nm(byPub.get(l.damId_public))) stats.noName++;
    }
    console.log(JSON.stringify(stats));
    console.log('unresolved examples [CTL, sire:status, dam:status, tags]:'); bad.forEach(b => console.log('  ', JSON.stringify(b)));
    console.log('litters with sirePrefixName null:', litters.filter(l => !l.sirePrefixName).length, '| damPrefixName null:', litters.filter(l => !l.damPrefixName).length, '| breedingPairCodeName set:', litters.filter(l => l.breedingPairCodeName).length);
    await L.mongoose.disconnect();
})().catch(e => { console.error(e); process.exit(1); });
