'use strict';
/**
 * Assigns litter_id_public (CTL numbers) to rebuilt litters that have none. The app opens litters by CTL
 * (GET /api/litters/:id_public, /:id_public/offspring), so litters without one cannot be opened.
 *
 *  - 3 litters get their REAL CTL (found in parents' breedingRecords in the backup, matched by sire/dam,
 *    birth date and litter size): CTL166, CTL187, CTL192.
 *  - All other litters get NEW numbers from CTL1001 upward (the app's own counter starts at 1000), ordered
 *    by birth date then _id so the numbering is chronological.
 *  - The 'litterId' counter is set to the last number used, so litters created in the app continue after it.
 *  - Only litters whose litter_id_public is currently empty are touched. Nothing else on a litter changes.
 * DRY RUN unless --confirm. Rollback: node scripts/seed/assign-ctl.js --rollback
 */
const L = require('./lib');
const fs = require('fs');
const ROLLBACK = 'C:\\Projects\\recovery-reports\\assign-ctl-rollback.json';
const confirm = process.argv.includes('--confirm');
const rollback = process.argv.includes('--rollback');
const START = 1000; // next CTL = 1001, same as the app's default counter

// Real CTLs, verified earlier against sire/dam, birth date and litter size.
const KNOWN = {
    '2f0b05b4b49ace469f46d26f': 'CTL166',
    '1cf2ea86fc1b155cd6243951': 'CTL187',
    '3de98a52da78b294c95674b7': 'CTL192',
};

(async () => {
    await L.mongoose.connect(process.env.MONGODB_URI);
    const d = L.mongoose.connection.db;
    const col = d.collection('litters');

    if (rollback) {
        const done = JSON.parse(fs.readFileSync(ROLLBACK, 'utf8'));
        const r = await col.updateMany({ _id: { $in: done.map(x => L.oid(x._id)) } }, { $set: { litter_id_public: null } });
        await d.collection('counters').updateOne({ _id: 'litterId' }, { $set: { seq: 1000 } });
        console.log('rolled back litters:', r.modifiedCount, '| counter reset to 1000');
        return;
    }

    const all = await col.find({}).project({ litter_id_public: 1, birthDate: 1 }).toArray();
    const have = new Set(all.map(l => l.litter_id_public).filter(Boolean));
    const todo = all.filter(l => !l.litter_id_public);
    console.log(`litters: ${all.length} | already have a CTL: ${have.size} | to assign: ${todo.length}`);

    const plan = [];
    for (const [id, ctl] of Object.entries(KNOWN)) {
        const l = todo.find(x => String(x._id) === id);
        if (!l) { console.log(`  note: ${ctl} target litter ${id} missing or already numbered`); continue; }
        if (have.has(ctl)) throw new Error(`${ctl} is already used by another litter`);
        plan.push({ _id: id, ctl, known: true });
        have.add(ctl);
    }
    const rest = todo.filter(l => !KNOWN[String(l._id)])
        .sort((a, b) => (new Date(a.birthDate || 0) - new Date(b.birthDate || 0)) || String(a._id).localeCompare(String(b._id)));
    let seq = START;
    for (const l of rest) {
        let ctl; do { seq += 1; ctl = 'CTL' + seq; } while (have.has(ctl));
        plan.push({ _id: String(l._id), ctl, known: false });
        have.add(ctl);
    }
    console.log(`real CTLs restored: ${plan.filter(p => p.known).length} | new CTLs: ${plan.filter(p => !p.known).length} | range CTL${START + 1}..CTL${seq}`);
    console.log('first 3 new:', plan.filter(p => !p.known).slice(0, 3).map(p => p.ctl).join(', '), '| last:', plan[plan.length - 1].ctl);
    if (new Set(plan.map(p => p.ctl)).size !== plan.length) throw new Error('duplicate CTL in plan');
    if (!confirm) { console.log('DRY RUN - nothing written. Re-run with --confirm.'); return; }

    fs.writeFileSync(ROLLBACK, JSON.stringify(plan));
    console.log('rollback file written:', ROLLBACK);
    let modified = 0;
    for (let i = 0; i < plan.length; i += 500) {
        const ops = plan.slice(i, i + 500).map(p => ({ updateOne: {
            filter: { _id: L.oid(p._id), $or: [{ litter_id_public: null }, { litter_id_public: { $exists: false } }] },
            update: { $set: { litter_id_public: p.ctl } } } }));
        modified += (await col.bulkWrite(ops, { ordered: false })).modifiedCount;
    }
    console.log('litters numbered:', modified);
    await d.collection('counters').updateOne({ _id: 'litterId' }, { $max: { seq } }, { upsert: true });
    console.log('counter litterId ->', (await d.collection('counters').findOne({ _id: 'litterId' })).seq);
})().catch(e => { console.error('FATAL', e.message); process.exitCode = 1; }).finally(() => L.mongoose.disconnect());
