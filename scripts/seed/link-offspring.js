'use strict';
/**
 * Links animals to the INFERRED litters (tag 'reconstructed') by setting animals.litterId.
 * Safety:
 *  - only animals whose litterId is currently null/missing are touched (never overwrites a link)
 *  - animal.creatorId must equal litter.creatorId, and animal.id_public must be in litter.offspringIds_public
 *  - raw collection update: updatedAt / other fields are NOT changed
 *  - writes a rollback file (animal _id list) BEFORE writing
 * DRY RUN unless --confirm.   Rollback: node scripts/seed/link-offspring.js --rollback
 */
const L = require('./lib');
const fs = require('fs');
const path = require('path');
const ROLLBACK = 'C:\\Projects\\recovery-reports\\link-offspring-rollback.json';
const confirm = process.argv.includes('--confirm');
const rollback = process.argv.includes('--rollback');

(async () => {
    await L.mongoose.connect(process.env.MONGODB_URI);
    const db = L.mongoose.connection.db;
    const animals = db.collection('animals');

    if (rollback) {
        const ids = JSON.parse(fs.readFileSync(ROLLBACK, 'utf8')).map(x => L.oid(x.animalId));
        const litterIds = [...new Set(JSON.parse(fs.readFileSync(ROLLBACK, 'utf8')).map(x => x.litterId))].map(L.oid);
        const r = await animals.updateMany({ _id: { $in: ids }, litterId: { $in: litterIds } }, { $set: { litterId: null } });
        console.log('rolled back animals:', r.modifiedCount);
        return;
    }

    const litters = await db.collection('litters').find({ tags: 'reconstructed' }).project({ creatorId: 1, offspringIds_public: 1 }).toArray();
    console.log('inferred litters:', litters.length);
    const plan = []; let skippedHasLink = 0, skippedOwner = 0, notFound = 0;
    // One read of all animals, matched in memory (per-litter queries were far too slow)
    const byPub = new Map((await animals.find({}).project({ _id: 1, id_public: 1, creatorId: 1, litterId: 1 }).toArray()).map(a => [a.id_public, a]));
    console.log('animals loaded:', byPub.size);
    for (const lit of litters) {
        const found = lit.offspringIds_public.map(id => byPub.get(id)).filter(Boolean);
        notFound += lit.offspringIds_public.length - found.length;
        for (const a of found) {
            if (a.litterId) { skippedHasLink++; continue; }
            if (String(a.creatorId) !== String(lit.creatorId)) { skippedOwner++; continue; }
            plan.push({ animalId: String(a._id), id_public: a.id_public, litterId: String(lit._id) });
        }
    }
    const perAnimal = new Map(); plan.forEach(p => perAnimal.set(p.animalId, (perAnimal.get(p.animalId) || 0) + 1));
    console.log(`animals to link: ${plan.length} | already linked (skipped): ${skippedHasLink} | owner mismatch (skipped): ${skippedOwner} | not found: ${notFound} | animals in more than one litter: ${[...perAnimal.values()].filter(n => n > 1).length}`);
    if (!confirm) { console.log('DRY RUN - nothing written. Re-run with --confirm.'); return; }

    fs.mkdirSync(path.dirname(ROLLBACK), { recursive: true });
    fs.writeFileSync(ROLLBACK, JSON.stringify(plan));
    console.log('rollback file written:', ROLLBACK);
    let modified = 0;
    for (let i = 0; i < plan.length; i += 500) {
        const ops = plan.slice(i, i + 500).map(p => ({ updateOne: { filter: { _id: L.oid(p.animalId), $or: [{ litterId: null }, { litterId: { $exists: false } }] }, update: { $set: { litterId: L.oid(p.litterId) } } } }));
        const r = await animals.bulkWrite(ops, { ordered: false });
        modified += r.modifiedCount;
    }
    console.log('animals linked:', modified);
})().catch(e => { console.error('FATAL', e); process.exitCode = 1; }).finally(() => L.mongoose.disconnect());
