'use strict';
/**
 * Uses animals.breederAssignedId (owners usually type their litter code there) to
 *  (1) set Litter.breedingPairCodeName on existing litters whose animals share one code (only where the name is empty), and
 *  (2) create litters for code groups no litter covers yet, and link those animals.
 * Skipped: numeric-only / 1-char codes and codes that span several sire+dam+birth combinations (numbering schemes).
 * Rollback file saved before writing. DRY RUN unless --confirm.   Undo: node scripts/seed/litter-names.js --rollback
 */
const L = require('./lib');
const C = require('./code-lib');
const fs = require('fs'), crypto = require('crypto');
const ROLLBACK = 'C:\\Projects\\recovery-reports\\litter-names-rollback.json';
const confirm = process.argv.includes('--confirm'), rollback = process.argv.includes('--rollback');

(async () => {
    await L.mongoose.connect(process.env.MONGODB_URI);
    const d = L.mongoose.connection.db, lit = d.collection('litters'), an = d.collection('animals');
    if (rollback) {
        const r = JSON.parse(fs.readFileSync(ROLLBACK, 'utf8'));
        await lit.updateMany({ _id: { $in: r.named.map(L.oid) } }, { $set: { breedingPairCodeName: null } });
        await an.updateMany({ _id: { $in: r.linked.map(L.oid) } }, { $set: { litterId: null } });
        await lit.deleteMany({ _id: { $in: r.created.map(L.oid) } });
        console.log('rolled back: names', r.named.length, '| unlinked animals', r.linked.length, '| deleted litters', r.created.length);
        return;
    }
    const animals = await an.find({}).project({ id_public: 1, creatorId: 1, creatorId_public: 1, breederAssignedId: 1, sireId_public: 1, damId_public: 1, birthDate: 1, litterId: 1, gender: 1 }).toArray();
    const litters = await lit.find({}).project({ creatorId: 1, offspringIds_public: 1, breedingPairCodeName: 1, litter_id_public: 1 }).toArray();
    const byPub = new Map(animals.map(a => [a.id_public, a]));
    const conflict = C.conflictingCodes(animals);
    console.log('codes skipped as numbering schemes:', conflict.size);

    const named = C.planNames(litters, byPub, conflict);
    console.log('(1) litters to name:', named.length, '| unanimous:', named.filter(x => x.n === x.of).length, '| majority:', named.filter(x => x.n !== x.of).length);
    console.log('    examples:', named.slice(0, 8).map(x => `${x.ctl}="${x.code}"(${x.n}/${x.of})`).join(' '));

    const covered = new Set(litters.flatMap(l => l.offspringIds_public || []));
    const { out: plan, candidates } = C.planNewLitters(animals, covered, conflict);
    let seq = (await d.collection('counters').findOne({ _id: 'litterId' })).seq;
    plan.forEach(m => { m.id = crypto.createHash('sha1').update('code-litter:' + m.key).digest('hex').slice(0, 24); m.ctl = 'CTL' + (++seq); });
    console.log('(2) code groups of >=2 animals with no litter:', candidates, '| safe to create:', plan.length, '| animals:', plan.reduce((n, m) => n + m.g.length, 0));
    console.log('    examples:', plan.slice(0, 6).map(m => `${m.g[0].creatorId_public}:"${m.code}"(${m.g.length}, sire ${m.sire || '-'}, dam ${m.dam || '-'}, ${m.birth || 'no date'})`).join(' ; '));
    if (!confirm) { console.log('DRY RUN - nothing written. Re-run with --confirm.'); return; }

    fs.writeFileSync(ROLLBACK, JSON.stringify({ named: named.map(x => x._id), created: plan.map(m => m.id), linked: plan.flatMap(m => m.g.map(a => String(a._id))) }));
    const empty = [{ breedingPairCodeName: null }, { breedingPairCodeName: { $exists: false } }];
    for (let i = 0; i < named.length; i += 500) await lit.bulkWrite(named.slice(i, i + 500).map(x => ({ updateOne: { filter: { _id: L.oid(x._id), $or: empty }, update: { $set: { breedingPairCodeName: x.code } } } })));
    const docs = plan.map(m => ({
        _id: L.oid(m.id), creatorId: L.oid(m.owner), linkedOwners: [], litter_id_public: m.ctl, breedingPairCodeName: m.code,
        sireId_public: m.sire, sirePrefixName: null, damId_public: m.dam, damPrefixName: null,
        birthDate: m.birth ? new Date(m.birth) : null, birthDateUnknown: !m.birth, offspringIds_public: m.g.map(a => a.id_public),
        maleCount: m.male, femaleCount: m.female, unknownCount: m.g.length - m.male - m.female,
        outcome: 'Unknown', breedingMethod: 'Unknown', isPlanned: false, tags: ['reconstructed', 'reconstructed-code'],
        notes: 'Recreated after a database loss: these animals share the same Breeder Assigned ID litter code. Dates and notes were not recovered.',
        createdAt: new Date(), updatedAt: new Date(), __v: 0,
    }));
    for (let i = 0; i < docs.length; i += 200) await lit.insertMany(docs.slice(i, i + 200), { ordered: false });
    if (docs.length) await d.collection('counters').updateOne({ _id: 'litterId' }, { $max: { seq } });
    for (const m of plan) await an.updateMany({ _id: { $in: m.g.map(a => a._id) }, $or: [{ litterId: null }, { litterId: { $exists: false } }] }, { $set: { litterId: L.oid(m.id) } });
    console.log('named:', named.length, '| litters created:', docs.length, '| counter ->', seq, '| rollback:', ROLLBACK);
})().catch(e => { console.error('FATAL', e.message); process.exitCode = 1; }).finally(() => L.mongoose.disconnect());
