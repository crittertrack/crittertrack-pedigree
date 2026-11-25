'use strict';
/**
 * READ-ONLY: list CTU2 litters that are still pending (no birth, not lost) but
 * whose expectedDueDate is already in the past, i.e. "overdue" births that the
 * "birth due" reminder keeps announcing until the user marks them born/lost.
 */
const L = require('./lib');
const OWNER = 'CTU2';

const day = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '-');
const days = (a, b) => Math.floor((new Date(a) - new Date(b)) / 86400000);

(async () => {
    await L.mongoose.connect(process.env.MONGODB_URI);
    const { Litter, User } = L.models;
    const owner = await User.collection.findOne({ id_public: OWNER }, { projection: { _id: 1 } });
    if (!owner) throw new Error(`${OWNER} user not found`);

    const now = new Date();
    console.log(`Reference "now" (machine clock): ${day(now)}`);

    const litters = await Litter.collection.find({
        creatorId: owner._id,
        birthDate: null,
        birthDateUnknown: { $ne: true },
        pregnancyLost: { $ne: true },
        expectedDueDate: { $lt: now },
    }).project({
        litter_id_public: 1, breedingPairCodeName: 1,
        sireId_public: 1, damId_public: 1,
        matingDate: 1, pregnancyDate: 1, expectedDueDate: 1,
    }).toArray();

    console.log(`Overdue pending litters: ${litters.length}`);
    for (const l of litters) {
        const retro = l.pregnancyDate && new Date(l.expectedDueDate) < new Date(l.pregnancyDate);
        console.log(
            `${l.litter_id_public || l.breedingPairCodeName || l._id} | ${l.breedingPairCodeName || ''}\n` +
            `  sire x dam: ${l.sireId_public || '?'} x ${l.damId_public || '?'}\n` +
            `  mated: ${day(l.matingDate)} | pregnant: ${day(l.pregnancyDate)} | due: ${day(l.expectedDueDate)} (${days(now, l.expectedDueDate)} days over)\n` +
            `  retroactive entry (due before confirm): ${retro}`
        );
    }

    await L.mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });