'use strict';
// READ-ONLY: which database is the live backend writing to? Looks for recent activity in both.
const L = require('./lib');
(async () => {
    await L.mongoose.connect(process.env.MONGODB_URI);
    const client = L.mongoose.connection.getClient();
    console.log('now:', new Date().toISOString());
    for (const name of ['crittertrackdb', 'test']) {
        const db = client.db(name);
        const cols = await db.listCollections().toArray();
        let total = 0; const nonEmpty = [];
        for (const c of cols) { const n = await db.collection(c.name).countDocuments(); total += n; if (n) nonEmpty.push(`${c.name}:${n}`); }
        console.log(`\n[${name}] collections=${cols.length} totalDocs=${total}`);
        console.log('  non-empty:', nonEmpty.join(', ') || 'none');
        if (cols.some(c => c.name === 'users')) {
            const u = db.collection('users');
            const reset = await u.find({ resetPasswordExpires: { $ne: null } }).project({ id_public: 1, resetPasswordExpires: 1 }).toArray();
            console.log('  users with a reset token set (a reset request WAS found a user here):', JSON.stringify(reset.map(x => [x.id_public, x.resetPasswordExpires])));
            const recent = await u.find({ lastActive: { $gte: new Date(Date.now() - 3600e3) } }).project({ id_public: 1, lastActive: 1 }).toArray();
            console.log('  users active in the last hour:', recent.length);
            console.log('  newest user createdAt:', JSON.stringify(await u.find({}).sort({ creationDate: -1 }).limit(1).project({ creationDate: 1, id_public: 1 }).toArray()));
        }
        const sys = db.collection('systemsettings'); if (cols.some(c => c.name === 'systemsettings')) console.log('  systemsettings docs:', await sys.countDocuments());
    }
    await L.mongoose.disconnect();
})().catch(e => { console.error(e); process.exit(1); });
