'use strict';
// READ-ONLY final state of the whole database + referential integrity across everything restored.
const L = require('./lib');
(async () => {
    await L.mongoose.connect(process.env.MONGODB_URI);
    const d = L.mongoose.connection.db;
    const cols = (await d.listCollections().toArray()).map(c => c.name).sort();
    const nonEmpty = [];
    for (const c of cols) { const n = await d.collection(c).estimatedDocumentCount(); if (n) nonEmpty.push(`${c}:${n}`); }
    console.log('non-empty collections (' + nonEmpty.length + '):', nonEmpty.join(', '));
    const ids = async (c, f = '_id') => new Set((await d.collection(c).distinct(f)).map(String));
    const users = await ids('users');
    const checks = [];
    const owned = async (col, field) => { const v = await d.collection(col).distinct(field); return v.filter(x => x && !users.has(String(x))).length; };
    checks.push(['animals.creatorId -> users', await owned('animals', 'creatorId')]);
    checks.push(['litters.creatorId -> users', await owned('litters', 'creatorId')]);
    checks.push(['enclosures.creatorId -> users', await owned('enclosures', 'creatorId')]);
    checks.push(['waitlistentries.userId -> users', await owned('waitlistentries', 'userId')]);
    checks.push(['transactions.userId -> users', await owned('transactions', 'userId')]);
    checks.push(['contacts.userId -> users', await owned('contacts', 'userId')]);
    checks.push(['appearancefieldoptions.userId -> users', await owned('appearancefieldoptions', 'userId')]);
    const lit = await ids('litters'), enc = await ids('enclosures'), wl = await ids('waitlistentries'), tx = await ids('transactions');
    const miss = async (field, set) => (await d.collection('animals').distinct(field)).filter(x => x && !set.has(String(x))).length;
    checks.push(['animals.litterId -> litters', await miss('litterId', lit)]);
    checks.push(['animals.reservedWaitlistEntryId -> waitlistentries', await miss('reservedWaitlistEntryId', wl)]);
    checks.push(['animals.saleTransactionId -> transactions', await miss('saleTransactionId', tx)]);
    checks.push(['animals.purchaseTransactionId -> transactions', await miss('purchaseTransactionId', tx)]);
    const living = (await d.collection('animals').find({ enclosureId: { $nin: [null, ''] }, deceasedDate: null }).project({ enclosureId: 1 }).toArray());
    checks.push(['living animals.enclosureId -> enclosures', living.filter(a => !enc.has(String(a.enclosureId))).length]);
    const ctl = (await d.collection('litters').find({}).project({ litter_id_public: 1 }).toArray()).map(l => l.litter_id_public);
    checks.push(['litters without / duplicate CTL', ctl.filter(c => !c).length + (ctl.length - new Set(ctl).size)]);
    console.log('\nunresolved references (0 is good; remaining ones are things that were never backed up):');
    checks.forEach(([k, v]) => console.log('  ' + (v === 0 ? 'OK  ' : 'LEFT') + ' ' + k + ': ' + v));
    console.log('\ncounters:', JSON.stringify((await d.collection('counters').find({}).toArray()).map(c => [c._id, c.seq])));
    await L.mongoose.disconnect();
})().catch(e => { console.error(e); process.exit(1); });
