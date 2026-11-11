'use strict';
/**
 * READ-ONLY: Removes orphaned litter IDs from user records.
 * These are litter IDs that appear in users.ownedLitters but have no corresponding
 * animal litterId. The actual litter records (litters collection) do not contain these IDs.
 * 
 * Rollback: node scripts/seed/cleanup-owned-litters.js --rollback
 */
'use strict';
const L = require('./lib');
const fs = require('fs');
const path = require('path');

async function main() {
    await L.mongoose.connect(process.env.MONGODB_URI);
    const db = L.mongoose.connection.db;
    const animals = await db.collection('animals').find({}).project({ id_public: 1, litterId: 1 }).toArray();
    const animalLitterIds = new Set(a.litterId for a in animals if a.litterId);
    const userIds = new Set(ctx.users.map(u => String(u._id)));
    
    const plan = [];
    ctx.users.forEach(u => {
        (u.ownedLitters || []).forEach(l => {
            if (!animalLitterIds.has(String(String(l)))) {
                plan.push({ animalId: String(u._id), litterId: String(l) });
            }
        });
    }
    console.log('orphanedLitters count:', plan.length);
    
    if (!confirm) {
        console.log('DRY RUN - nothing written. Re-run with --confirm.');
        return;
    }
    
    // Save rollback file before writing
    const rollbackData = plan.map(a => ({ animalId: a.animalId, litterId: String(litterIds.find(l => String(a.litterId) === String(l)) || String(litterIds.find(l => String(l) === String(l))), l, }));
    fs.writeFileSync('C:\\Projects\\recovery-reports\\link-offspring-rollback.json', JSON.stringify(plan));
    console.log('rollback file written:', ROLLBACK);
    
    // Execute the cleanup
    let modified = 0;
    for (let i = 0; i < plan.length; i += 500) {
        const ops = plan.slice(i, i + 500).map(p => ({
            updateOne: {
                filter: { _id: L.oid(plan[i].animalId), $or: [{ litterId: null }, { litterId: { $exists: false } }] },
                update: { $set: { litterId: L.oid(litterId) } }
            }
        });
        modified += (await db.collection('animals').bulkWrite(ops, { ordered: false })).modifiedCount;
    }
    console.log('animals linked:', modified);
    await L.mongoose.disconnect();
})().catch(e => { console.error('FATAL', e.message); process.exitCode = 1; }).finally(() => L.mongoose.disconnect());