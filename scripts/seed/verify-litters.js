'use strict';
// READ-ONLY check of litters after seeding.
const L = require('./lib');
(async () => {
    await L.mongoose.connect(process.env.MONGODB_URI);
    const d = L.mongoose.connection.db;
    const litters = d.collection('litters');
    console.log('litters total:', await litters.countDocuments(), '| inferred (tag reconstructed):', await litters.countDocuments({ tags: 'reconstructed' }));
    const users = new Set((await d.collection('users').distinct('_id')).map(String));
    const all = await litters.find({}).project({ creatorId: 1, offspringIds_public: 1, sireId_public: 1, damId_public: 1 }).toArray();
    console.log('litters with missing owner:', all.filter(l => !users.has(String(l.creatorId))).length);
    const animals = new Set((await d.collection('animals').distinct('id_public')));
    const bad = all.flatMap(l => l.offspringIds_public).filter(x => !animals.has(x));
    console.log('offspring ids not found in animals:', bad.length);
    console.log('parents not found in animals:', all.filter(l => !animals.has(l.sireId_public) || !animals.has(l.damId_public)).length);
    console.log('animals still carrying litterId (unchanged):', await d.collection('animals').countDocuments({ litterId: { $ne: null } }));
    console.log('animals total (unchanged):', await d.collection('animals').countDocuments());
    const doc = await L.models.Litter.findOne({ tags: 'reconstructed' }).lean();
    console.log('mongoose read ok:', !!doc, '|', doc.sireId_public, doc.damId_public, String(doc.birthDate).slice(0, 15), 'offspring', doc.offspringIds_public.length);
    await L.mongoose.disconnect();
})().catch(e => { console.error(e); process.exit(1); });
