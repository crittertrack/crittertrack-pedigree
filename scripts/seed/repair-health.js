'use strict';
/**
 * Repairs health-record arrays that were stored corrupted as character maps ({"0":"[","1":"{",...}) in the backup.
 * The original JSON text is rebuilt character by character and parsed back into the record list. Applies to the
 * Animal AND its PublicAnimal mirror. Only touches arrays where EVERY element is a character map; rollback file saved.
 * DRY RUN unless --confirm.
 */
const L = require('./lib');
const fs = require('fs');
const ROLLBACK = 'C:\\Projects\\recovery-reports\\repair-health-rollback.json';
const FIELDS = ['vaccinations', 'dewormingRecords', 'parasiteControl', 'medicalConditions', 'allergies', 'medications', 'medicalProcedures', 'labResults', 'vetVisits'];
const confirm = process.argv.includes('--confirm');
const isMap = (o) => o && typeof o === 'object' && !Array.isArray(o) && '0' in o && typeof o['0'] === 'string' && o['0'].length === 1;
const rebuild = (o) => Object.keys(o).filter(k => /^\d+$/.test(k)).sort((a, b) => a - b).map(k => o[k]).join('');

(async () => {
    await L.mongoose.connect(process.env.MONGODB_URI);
    const d = L.mongoose.connection.db;
    const plan = [];
    for (const colName of ['animals', 'publicanimals']) {
        const docs = await d.collection(colName).find({ $or: FIELDS.map(f => ({ [f + '.0.0']: { $exists: true } })) }).toArray();
        for (const doc of docs) for (const f of FIELDS) {
            const arr = doc[f]; if (!Array.isArray(arr) || !arr.length || !arr.every(isMap)) continue;
            const fixed = arr.flatMap(x => { const v = JSON.parse(rebuild(x)); return Array.isArray(v) ? v : [v]; });
            plan.push({ col: colName, _id: String(doc._id), id_public: doc.id_public, field: f, before: arr, after: fixed });
        }
    }
    console.log('arrays to repair:', plan.length);
    plan.forEach(p => console.log(`  ${p.col} ${p.id_public} ${p.field}: ${p.before.length} char-map(s) -> ${p.after.length} record(s): ${JSON.stringify(p.after).slice(0, 110)}`));
    if (!confirm) { console.log('DRY RUN - nothing written. Re-run with --confirm.'); return; }
    fs.writeFileSync(ROLLBACK, JSON.stringify(plan));
    for (const p of plan) await d.collection(p.col).updateOne({ _id: L.oid(p._id) }, { $set: { [p.field]: p.after } });
    console.log('repaired:', plan.length, '| rollback file:', ROLLBACK);
})().catch(e => { console.error('FATAL', e.message); process.exitCode = 1; }).finally(() => L.mongoose.disconnect());
