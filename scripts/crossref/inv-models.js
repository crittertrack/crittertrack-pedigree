'use strict';
/** READ-ONLY: every Mongoose model vs the live DB: collection, live count, required fields, ref fields. */
const L = require('../seed/lib');
(async () => {
    await L.mongoose.connect(process.env.MONGODB_URI);
    const d = L.mongoose.connection.db;
    const names = new Set((await d.listCollections().toArray()).map(c => c.name));
    const rows = [];
    for (const [mName, Model] of Object.entries(L.models)) {
        if (!Model || !Model.schema) continue;
        const col = Model.collection.collectionName;
        const n = names.has(col) ? await d.collection(col).estimatedDocumentCount() : -1;
        const req = [], refs = [];
        Model.schema.eachPath((p, t) => { if (t.isRequired) req.push(p); if (t.options && t.options.ref) refs.push(p + '->' + t.options.ref); });
        rows.push({ mName, col, n, req: req.filter(x => x !== '_id'), refs });
    }
    rows.sort((a, b) => a.n - b.n || a.col.localeCompare(b.col));
    for (const r of rows) console.log(`${String(r.n).padStart(6)} ${r.col.padEnd(30)} req: ${r.req.join(',') || '-'} | refs: ${r.refs.join(',') || '-'}`);
    await L.mongoose.disconnect();
})().catch(e => { console.error(e); process.exit(1); });
