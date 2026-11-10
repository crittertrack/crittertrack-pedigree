'use strict';
// READ-ONLY verification of CTL numbers and the litter <-> offspring links, using the same queries the app routes use.
const L = require('./lib');
(async () => {
    await L.mongoose.connect(process.env.MONGODB_URI);
    const d = L.mongoose.connection.db;
    const { Litter, Animal } = L.models;
    const litters = await d.collection('litters').find({}).project({ litter_id_public: 1, offspringIds_public: 1 }).toArray();
    const ctls = litters.map(l => l.litter_id_public);
    console.log('litters:', litters.length, '| without CTL:', ctls.filter(c => !c).length, '| duplicate CTLs:', ctls.length - new Set(ctls).size);
    console.log('real CTLs present:', ['CTL166', 'CTL187', 'CTL192'].map(c => c + '=' + ctls.includes(c)).join(' '));

    // Same call as GET /api/litters/:id_public and /:id_public/offspring
    for (const ctl of ['CTL166', 'CTL1001', 'CTL1985']) {
        const lit = await Litter.findOne({ litter_id_public: ctl }).select('offspringIds_public sireId_public damId_public').lean();
        const kids = lit ? await Animal.find({ id_public: { $in: lit.offspringIds_public } }).select('id_public litterId').lean() : [];
        console.log(ctl, '-> found:', !!lit, '| offspring listed:', lit && lit.offspringIds_public.length, '| animals returned:', kids.length, '| of those linked back to a litter:', kids.filter(k => k.litterId).length);
    }
    // getLittersForAnimal-style lookup: a parent and an offspring
    const parentLits = await Litter.find({ $or: [{ sireId_public: 'CTC26' }, { damId_public: 'CTC26' }] }).select('litter_id_public').lean();
    console.log('litters found for parent CTC26:', parentLits.length, parentLits.slice(0, 3).map(x => x.litter_id_public).join(','));

    const counter = await d.collection('counters').findOne({ _id: 'litterId' });
    console.log('litterId counter:', counter.seq, '-> next litter created in the app would be CTL' + (counter.seq + 1));
    console.log('CTL' + (counter.seq + 1), 'already used?', ctls.includes('CTL' + (counter.seq + 1)));
    await L.mongoose.disconnect();
})().catch(e => { console.error(e); process.exit(1); });
