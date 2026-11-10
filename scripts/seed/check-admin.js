'use strict';
// READ-ONLY diagnostic: which databases exist on the new cluster, and what do the privileged accounts look like (emails masked).
const L = require('./lib');
const mask = (e) => { if (!e) return null; const [a, b] = String(e).split('@'); return a.slice(0, 2) + '***' + (a.length > 2 ? a.slice(-1) : '') + '@' + b; };
(async () => {
    await L.mongoose.connect(process.env.MONGODB_URI);
    const client = L.mongoose.connection.getClient();
    const dbs = (await client.db().admin().listDatabases()).databases;
    for (const d of dbs) {
        if (['admin', 'local'].includes(d.name)) continue;
        const cols = await client.db(d.name).listCollections().toArray();
        const users = cols.some(c => c.name === 'users') ? await client.db(d.name).collection('users').countDocuments() : 0;
        console.log('db', d.name, '| collections', cols.length, '| users', users);
    }
    const col = L.mongoose.connection.db.collection('users');
    console.log('distinct roles:', JSON.stringify(await col.distinct('role')));
    const priv = await col.find({ role: { $nin: ['user', null] } }).project({ email: 1, id_public: 1, role: 1, emailVerified: 1, accountStatus: 1, recoveryEmail: 1, two_factor_enabled: 1 }).toArray();
    console.log('privileged accounts:');
    priv.forEach(u => console.log(' ', JSON.stringify({ id: u.id_public, role: u.role, email: mask(u.email), verified: u.emailVerified, status: u.accountStatus, recovery: mask(u.recoveryEmail), tfa: u.two_factor_enabled })));
    const first = await col.find({ id_public: { $in: ['CTU1', 'CTU2'] } }).project({ email: 1, id_public: 1, role: 1, emailVerified: 1 }).toArray();
    console.log('CTU1/CTU2:', JSON.stringify(first.map(u => ({ id: u.id_public, role: u.role, email: mask(u.email), verified: u.emailVerified }))));
    await L.mongoose.disconnect();
})().catch(e => { console.error(e); process.exit(1); });
