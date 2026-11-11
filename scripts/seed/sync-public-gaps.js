'use strict';
/**
 * Creates the missing publicAnimals mirrors for animals with isDisplay=true that have no public copy, using the app's
 * own function (utils/syncPublicAnimals.resyncAnimalToPublic), so the result is exactly what the app would have written.
 * Insert-only: skips any animal that already has a public copy. DRY RUN unless --confirm.
 */
const L = require('./lib');
// syncAnimalToPublic writes the FULL animal as the public copy (like the 6,956 existing ones).
// (resyncAnimalToPublic only $sets a few mirrored fields, which would create a near-empty document here.)
const { syncAnimalToPublic } = require('../../utils/syncPublicAnimals');
const confirm = process.argv.includes('--confirm');

(async () => {
    await L.mongoose.connect(process.env.MONGODB_URI);
    const d = L.mongoose.connection.db;
    const pubIds = new Set((await d.collection('publicanimals').find({}).project({ id_public: 1 }).toArray()).map(x => x.id_public));
    const gap = (await d.collection('animals').find({ isDisplay: true }).toArray()).filter(a => !pubIds.has(a.id_public));
    console.log('animals isDisplay=true: missing public copy:', gap.length, '| deceased:', gap.filter(a => a.deceasedDate).length);
    gap.slice(0, 5).forEach(a => console.log('  ', a.id_public, a.name, a.species, a.creatorId_public, String(a.createdAt).slice(0, 10)));
    if (!confirm) { console.log('DRY RUN - nothing written. Re-run with --confirm.'); return; }
    for (const a of gap) await syncAnimalToPublic(a);
    const after = await d.collection('publicanimals').find({ id_public: { $in: gap.map(a => a.id_public) } }).toArray();
    console.log('public copies now present for', after.length, 'of', gap.length, '| publicanimals total:', await d.collection('publicanimals').countDocuments());
    const thin = after.filter(p => !p.name || !p.species || !p.creatorId_public);
    console.log('public copies missing name/species/creator (should be 0):', thin.length, '| field count sample:', Object.keys(after[0] || {}).length, 'vs animal', Object.keys(gap[0] || {}).length);
})().catch(e => { console.error('FATAL', e.message); process.exitCode = 1; }).finally(() => L.mongoose.disconnect());
