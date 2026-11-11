'use strict';
/**
 * Fills Species.maxNursingDays (the safety net that clears a dam's "Nursing" flag when no weaning date was
 * recorded; see utils/reproStatusSync.js). Values come from the project's own migration in git history.
 * Only species where maxNursingDays is empty are set. DRY RUN unless --confirm.
 */
const L = require('./lib');
const { CATEGORY_DEFAULTS, SPECIES_DAYS } = require('../data-nursing-days');
const confirm = process.argv.includes('--confirm');

(async () => {
    await L.mongoose.connect(process.env.MONGODB_URI);
    const col = L.mongoose.connection.db.collection('species');
    const all = await col.find({}).project({ name: 1, category: 1, maxNursingDays: 1 }).toArray();
    const todo = all.filter(s => s.maxNursingDays === null || s.maxNursingDays === undefined);
    const plan = todo.map(s => ({ _id: s._id, name: s.name, days: SPECIES_DAYS[s.name] ?? CATEGORY_DEFAULTS[s.category] ?? CATEGORY_DEFAULTS.Other, explicit: s.name in SPECIES_DAYS }));
    console.log(`species: ${all.length} | need a value: ${plan.length} | explicit per-species: ${plan.filter(p => p.explicit).length} | category fallback: ${plan.filter(p => !p.explicit).length}`);
    console.log('fallbacks (check these):', plan.filter(p => !p.explicit).map(p => `${p.name}=${p.days}`).join(', '));
    console.log('examples:', plan.filter(p => p.explicit).slice(0, 6).map(p => `${p.name}=${p.days}`).join(', '));
    if (!confirm) { console.log('DRY RUN - nothing written. Re-run with --confirm.'); return; }
    const r = await col.bulkWrite(plan.map(p => ({ updateOne: { filter: { _id: p._id, maxNursingDays: { $in: [null] } }, update: { $set: { maxNursingDays: p.days } } } })));
    const r2 = await col.bulkWrite(plan.map(p => ({ updateOne: { filter: { _id: p._id, maxNursingDays: { $exists: false } }, update: { $set: { maxNursingDays: p.days } } } })));
    console.log('species updated:', r.modifiedCount + r2.modifiedCount);
})().catch(e => { console.error('FATAL', e.message); process.exitCode = 1; }).finally(() => L.mongoose.disconnect());
