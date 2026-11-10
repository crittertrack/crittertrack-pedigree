'use strict';
// READ-ONLY end-to-end check of the new backup export against the real database. Nothing is uploaded or written to Mongo.
const L = require('./lib');
const be = require('../../utils/backupExport');
(async () => {
    await L.mongoose.connect(process.env.MONGODB_URI);
    const db = L.mongoose.connection.db;
    const names = await be.listBackupCollections(db);
    console.log('collections that WILL be backed up:', names.length);
    console.log(names.join(', '));
    const live = await be.getAllCounts(db);
    const nonEmpty = Object.entries(live).filter(([, n]) => n > 0);
    console.log('\nnon-empty:', nonEmpty.map(([k, n]) => `${k}:${n}`).join(', '));

    let total = 0, bad = 0;
    for (const [fileName, n] of nonEmpty) {
        const colName = be.collectionFor(fileName);
        const exp = await be.exportCollection(db, colName);
        total += Buffer.byteLength(exp.body, 'utf8');
        const back = be.EJSON.parse(exp.body);
        const orig = await db.collection(colName).find({}).project({ _id: 1 }).toArray();
        const ok = back.length === orig.length && back.every((d, i) => String(d._id) === String(orig[i]._id) && d._id.constructor.name === 'ObjectId' || typeof d._id === 'string');
        if (!ok) { bad++; console.log('  MISMATCH', fileName, back.length, orig.length); }
    }
    console.log(`\nexported + parsed back ${nonEmpty.length} collections, ${(total / 1048576).toFixed(1)} MB, mismatches: ${bad}`);

    const users = (await be.exportCollection(db, 'users')).body;
    const leaked = be.SECRET_USER_FIELDS.filter(f => new RegExp(`"${f}"`).test(users));
    console.log('secret fields present in exported users:', leaked.length ? leaked.join(',') : 'none');

    const prev = { users: 173, animals: 8125 };
    console.log('guard on healthy db  ->', be.looksLikeDataLoss({ users: live.users, animals: live.animals }, prev));
    console.log('guard on emptied db  ->', be.looksLikeDataLoss({ users: 0, animals: 0 }, prev));
    await L.mongoose.disconnect();
})().catch(e => { console.error(e); process.exit(1); });
