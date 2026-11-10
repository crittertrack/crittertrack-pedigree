'use strict';
// READ-ONLY verification of planned litters, enclosures and waitlist entries.
const L = require('./lib');
(async () => {
    await L.mongoose.connect(process.env.MONGODB_URI);
    const d = L.mongoose.connection.db;
    const { Enclosure, WaitlistEntry, Litter } = L.models;

    const encIds = new Set((await d.collection('enclosures').find({}).project({ _id: 1, creatorId: 1 }).toArray()).map(e => String(e._id)));
    const encOwner = new Map((await d.collection('enclosures').find({}).project({ creatorId: 1 }).toArray()).map(e => [String(e._id), String(e.creatorId)]));
    const animals = await d.collection('animals').find({ enclosureId: { $nin: [null, ''] } }).project({ id_public: 1, enclosureId: 1, creatorId: 1, deceasedDate: 1 }).toArray();
    const living = animals.filter(a => !a.deceasedDate);
    console.log('enclosures:', encIds.size, '| animals with enclosureId:', animals.length, '| living:', living.length);
    console.log('living animals whose enclosureId now resolves:', living.filter(a => encIds.has(String(a.enclosureId))).length, '| owner mismatch:', living.filter(a => encOwner.has(String(a.enclosureId)) && encOwner.get(String(a.enclosureId)) !== String(a.creatorId)).length);
    console.log('deceased animals still pointing at a missing enclosure (left as is):', animals.filter(a => a.deceasedDate && !encIds.has(String(a.enclosureId))).length);
    const e = await Enclosure.findOne({}).lean(); console.log('mongoose Enclosure read ok:', !!e, '|', e.name, '|', e.purpose);

    const wl = await d.collection('waitlistentries').find({}).toArray();
    const resv = await d.collection('animals').find({ reservedWaitlistEntryId: { $ne: null } }).project({ reservedWaitlistEntryId: 1, creatorId: 1 }).toArray();
    const wlIds = new Map(wl.map(w => [String(w._id), String(w.userId)]));
    console.log('waitlist entries:', wl.length, '| reserved animals:', resv.length, '| resolve to an entry:', resv.filter(a => wlIds.has(String(a.reservedWaitlistEntryId))).length, '| owner mismatch:', resv.filter(a => wlIds.get(String(a.reservedWaitlistEntryId)) !== String(a.creatorId)).length);
    const w = await WaitlistEntry.findOne({}).lean(); console.log('mongoose WaitlistEntry read ok:', !!w, '|', w.name, '|', JSON.stringify(w.speciesRequests[0].genderCounts));

    const planned = await Litter.find({ tags: 'reconstructed-planned' }).lean();
    console.log('planned litters:', planned.map(p => `${p.litter_id_public} ${p.sireId_public}x${p.damId_public} planned=${p.isPlanned}`).join(' | '));
    const all = (await d.collection('litters').find({}).project({ litter_id_public: 1 }).toArray()).map(l => l.litter_id_public);
    console.log('litters total:', all.length, '| duplicate CTLs:', all.length - new Set(all).size, '| counter:', (await d.collection('counters').findOne({ _id: 'litterId' })).seq);
    await L.mongoose.disconnect();
})().catch(e => { console.error(e); process.exit(1); });
