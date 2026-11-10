'use strict';
// READ-ONLY: do the 3 CTL ids found in breeding records match any rebuilt litter?
const L = require('./lib');
(async () => {
    await L.mongoose.connect(process.env.MONGODB_URI);
    const d = L.mongoose.connection.db;
    const DAY = 86400000;
    const targets = [['CTL166', ['CTC11', 'CTC111'], '2026-02-07'], ['CTL192', ['CTC1157', 'CTC1162', 'CTC1161'], '2026-02-28'], ['CTL187', ['CTC1168', 'CTC1162', 'CTC1161'], '2026-02-25']];
    for (const [ctl, ids, birth] of targets) {
        const t = new Date(birth).getTime();
        const q = { birthDate: { $gte: new Date(t - 2 * DAY), $lte: new Date(t + 2 * DAY) }, $or: ids.flatMap(i => [{ sireId_public: i }, { damId_public: i }]) };
        const r = await d.collection('litters').find(q).project({ sireId_public: 1, damId_public: 1, birthDate: 1, offspringIds_public: 1, tags: 1 }).toArray();
        console.log(ctl, 'candidates:', JSON.stringify(r.map(x => [String(x._id), x.sireId_public, x.damId_public, String(x.birthDate).slice(4, 15), 'offspring=' + x.offspringIds_public.length, (x.tags || []).join()])));
    }
    console.log('counter litterId:', JSON.stringify(await d.collection('counters').findOne({ _id: 'litterId' })));
    console.log('litters with CTL:', await d.collection('litters').countDocuments({ litter_id_public: { $ne: null } }), '| without:', await d.collection('litters').countDocuments({ litter_id_public: null }));
    const idx = await d.collection('litters').indexes();
    console.log('litter_id_public index:', JSON.stringify(idx.filter(i => i.key.litter_id_public)));
    await L.mongoose.disconnect();
})().catch(e => { console.error(e); process.exit(1); });
