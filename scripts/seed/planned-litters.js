'use strict';
/**
 * planned-litters: animals flagged isPlannedMating whose pairing is UNAMBIGUOUS (same owner + same species,
 * exactly one living male and one living female flagged planned). Creates a planned Litter (isPlanned:true,
 * no birth date) for each pair. Groups with several males/females are NOT guessed; they are listed for the
 * owners to re-enter. Each gets a CTL from the app's own counter. Insert-only; animals are not modified.
 */
const crypto = require('crypto');

module.exports = async (L, ctx) => {
    const { Litter } = L.models;
    const userIds = new Set(ctx.users.map(u => String(u._id)));
    const groups = new Map();
    ctx.animals.filter(a => a.isPlannedMating && !a.deceasedDate).forEach(a => {
        const k = String(a.creatorId) + '|' + a.species; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(a);
    });
    const label = (a) => [a.prefix, a.name].filter(Boolean).join(' ').trim() || null;
    const pairs = [], left = [];
    for (const [k, g] of groups) {
        const m = g.filter(a => a.gender === 'Male'), f = g.filter(a => a.gender === 'Female');
        if (m.length === 1 && f.length === 1 && userIds.has(String(m[0].creatorId))) pairs.push([m[0], f[0]]);
        else left.push(`${g[0].creatorId_public} ${g[0].species}: ${m.length}M/${f.length}F planned (${g.map(a => a.id_public).join(' ')})`);
    }
    L.log(`  pairable planned matings: ${pairs.length} | not guessed (ambiguous or single-sex): ${left.length}`);
    left.forEach(x => L.log('    left for owners: ' + x));

    const existing = await Litter.collection.find({ tags: 'reconstructed-planned' }).project({ _id: 1 }).toArray();
    const have = new Set(existing.map(x => String(x._id)));
    const docs = [];
    const counters = L.mongoose.connection.db.collection('counters');
    const cur = (await counters.findOne({ _id: 'litterId' })) || { seq: 1000 };
    let seq = cur.seq;
    for (const [sire, dam] of pairs) {
        const id = crypto.createHash('sha1').update('planned-litter:' + sire.id_public + '|' + dam.id_public).digest('hex').slice(0, 24);
        if (have.has(id)) continue;
        seq += 1;
        docs.push({
            _id: L.oid(id), creatorId: L.oid(sire.creatorId), linkedOwners: [], litter_id_public: 'CTL' + seq,
            sireId_public: sire.id_public, sirePrefixName: label(sire), damId_public: dam.id_public, damPrefixName: label(dam),
            isPlanned: true, birthDate: null, matingDate: null, outcome: 'Unknown', breedingMethod: 'Unknown', offspringIds_public: [],
            tags: ['reconstructed-planned'],
            notes: 'Recreated after a database loss: both animals were still flagged as planned breeding. Dates and notes were not recovered.',
            createdAt: new Date(), updatedAt: new Date(), __v: 0,
        });
    }
    docs.forEach(d => L.log(`    ${d.litter_id_public}: ${d.sireId_public} (sire) x ${d.damId_public} (dam)`));
    await L.insertByIds(Litter, docs, 'planned litters');
    if (L.confirm && docs.length) await counters.updateOne({ _id: 'litterId' }, { $max: { seq } }, { upsert: true });
};
