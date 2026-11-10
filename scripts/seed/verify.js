'use strict';
// Read-only check of the new cluster after seeding.
const L = require('./lib');
(async () => {
    await L.mongoose.connect(process.env.MONGODB_URI);
    const d = L.mongoose.connection.db;
    for (const c of ['users', 'publicprofiles', 'animals', 'publicanimals', 'counters', 'species', 'carechecklisttemplates', 'litters', 'transactions'])
        console.log(c.padEnd(24), await d.collection(c).countDocuments());
    const lit = await d.collection('animals').distinct('litterId', { litterId: { $ne: null } });
    const have = new Set((await d.collection('litters').find({}, { projection: { _id: 1 } }).toArray()).map(x => String(x._id)));
    console.log('animal litterIds:', lit.length, '| now resolving to a litter:', lit.filter(x => have.has(String(x))).length);
    const doc = await L.models.Litter.findOne({}).lean();
    console.log('mongoose Litter read ok:', !!doc, '| offspring:', doc.offspringIds_public.length, '| sire/dam:', doc.sireId_public, doc.damId_public, '| birth:', doc.birthDate);
    const spec = await L.models.Species.countDocuments({ isDefault: true });
    console.log('mongoose Species default count:', spec);
    const tx = await L.models.Transaction.find({}).select('type price animalId date').lean();
    console.log('transactions:', JSON.stringify(tx.map(t => [t.type, t.animalId, t.price, String(t.date).slice(0, 10)])));
    const orphanOwners = await d.collection('litters').countDocuments({ creatorId: { $nin: (await d.collection('users').distinct('_id')) } });
    console.log('litters whose creator is missing from users:', orphanOwners);
    await L.mongoose.disconnect();
})().catch(e => { console.error(e); process.exit(1); });
