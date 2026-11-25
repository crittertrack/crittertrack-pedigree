'use strict';
/**
 * Nudge forward the expectedDueDate of CTU2 litters that are STILL PREGNANT
 * (pregnancyDate set) but whose due date has already passed, so the "birth due"
 * reminder stops firing as overdue. Moves each due date +NUDGE_DAYS (default 7)
 * later.
 *
 * Only targets litters with a pregnancyDate (the "still pregnant" does); litters
 * that are just mated (no pregnancyDate) are untouched.
 *
 * DRY RUN by default (reads only). Pass --confirm to write.
 */
const L = require('./lib');
const OWNER = 'CTU2';
const NUDGE_DAYS = 7;

const day = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '-');
const addDays = (d, n) => { const t = new Date(d); t.setUTCDate(t.getUTCDate() + n); return t; };

(async () => {
    await L.mongoose.connect(process.env.MONGODB_URI);
    const { Litter, User } = L.models;
    console.log(L.confirm ? '*** WRITING ***' : '--- DRY RUN (no writes) ---');

    const owner = await User.collection.findOne({ id_public: OWNER }, { projection: { _id: 1 } });
    if (!owner) throw new Error(`${OWNER} user not found`);

    const now = new Date();
    console.log(`Reference "now": ${day(now)} | nudge = +${NUDGE_DAYS} days`);

    const litters = await Litter.collection.find({
        creatorId: owner._id,
        pregnancyDate: { $ne: null },
        expectedDueDate: { $lt: now },
        birthDate: null,
        birthDateUnknown: { $ne: true },
        pregnancyLost: { $ne: true },
    }).project({ litter_id_public: 1, breedingPairCodeName: 1, expectedDueDate: 1 }).toArray();
    console.log(`Overdue still-pregnant litters: ${litters.length}`);

    let changed = 0;
    for (const l of litters) {
        const next = addDays(l.expectedDueDate, NUDGE_DAYS);
        console.log(`UPDATE ${l.litter_id_public || l.breedingPairCodeName || l._id}: due ${day(l.expectedDueDate)} -> ${day(next)}`);
        changed++;
        if (L.confirm) await Litter.collection.updateOne({ _id: l._id }, { $set: { expectedDueDate: next } });
    }

    console.log(`${L.confirm ? 'Updated' : 'Would update'}: ${changed}`);
    await L.mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });