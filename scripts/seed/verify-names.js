'use strict';
// READ-ONLY verification of litter pair names and the code-based litters.
const L = require('./lib');
(async () => {
    await L.mongoose.connect(process.env.MONGODB_URI);
    const d = L.mongoose.connection.db;
    const lit = await d.collection('litters').find({}).project({ litter_id_public: 1, breedingPairCodeName: 1, offspringIds_public: 1, creatorId: 1, tags: 1 }).toArray();
    const named = lit.filter(l => l.breedingPairCodeName);
    console.log('litters:', lit.length, '| with a pair name:', named.length, '| from code step:', lit.filter(l => (l.tags || []).includes('reconstructed-code')).length);
    const ctl = lit.map(l => l.litter_id_public);
    console.log('missing/duplicate CTL:', ctl.filter(c => !c).length + (ctl.length - new Set(ctl).size));
    console.log('sample:', named.slice(0, 6).map(l => `${l.litter_id_public}="${l.breedingPairCodeName}"`).join(' '));
    // each animal in exactly one litter list; animals.litterId matches the litter that lists it
    const animals = await d.collection('animals').find({ litterId: { $ne: null } }).project({ id_public: 1, litterId: 1, creatorId: 1 }).toArray();
    const byId = new Map(lit.map(l => [String(l._id), l]));
    console.log('animals with litterId:', animals.length, '| pointing at a missing litter:', animals.filter(a => !byId.has(String(a.litterId))).length,
        '| litter does not list the animal:', animals.filter(a => byId.has(String(a.litterId)) && !byId.get(String(a.litterId)).offspringIds_public.includes(a.id_public)).length,
        '| owner mismatch:', animals.filter(a => byId.has(String(a.litterId)) && String(byId.get(String(a.litterId)).creatorId) !== String(a.creatorId)).length);
    const listed = lit.flatMap(l => l.offspringIds_public); console.log('animals listed by more than one litter:', listed.length - new Set(listed).size);
    console.log('counter:', (await d.collection('counters').findOne({ _id: 'litterId' })).seq, '| highest CTL used:', Math.max(...ctl.map(c => parseInt(c.slice(3), 10))));
    const { Litter } = L.models; const one = await Litter.findOne({ breedingPairCodeName: { $ne: null } }).lean(); console.log('mongoose read ok:', !!one, '|', one.litter_id_public, one.breedingPairCodeName);
    await L.mongoose.disconnect();
})().catch(e => { console.error(e); process.exit(1); });
