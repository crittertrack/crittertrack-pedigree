'use strict';
/**
 * enclosures: recreated from animals.enclosureId (+ publicAnimals) so every animal's enclosure link resolves again.
 * Exact _id kept. Name, dimensions, location and supplies were never recoverable, so each gets a neutral
 * placeholder name ("<Species> enclosure N") that the owner can rename.
 *  - one owner per enclosure (verified: no enclosure is shared by two owners)
 *  - enclosures where EVERY animal is deceased are skipped (stale pointers) unless --include-dead
 */
module.exports = async (L, ctx) => {
    const { Enclosure } = L.models;
    const fs = require('fs'), path = require('path');
    const pub = JSON.parse(fs.readFileSync(path.join(L.BACKUP_DIR || 'C:\\Projects', 'backups_auto-backup-2026-11-10T03-00-00_publicAnimals.json'), 'utf8'));
    const userByPub = new Map(ctx.users.map(u => [u.id_public, u]));
    const userIds = new Set(ctx.users.map(u => String(u._id)));

    const groups = new Map();
    ctx.animals.filter(a => a.enclosureId).forEach(a => {
        if (!groups.has(a.enclosureId)) groups.set(a.enclosureId, { owners: [], animals: [] });
        const g = groups.get(a.enclosureId); g.owners.push(String(a.creatorId)); g.animals.push(a);
    });
    let publicOnly = 0;
    pub.filter(a => a.enclosureId && !groups.has(a.enclosureId)).forEach(a => {
        const u = userByPub.get(a.creatorId_public); if (!u) return;
        if (!groups.has(a.enclosureId)) { groups.set(a.enclosureId, { owners: [], animals: [] }); publicOnly++; }
        groups.get(a.enclosureId).owners.push(String(u._id)); groups.get(a.enclosureId).animals.push(a);
    });
    L.log(`  enclosure ids: ${groups.size} (from public records only: ${publicOnly})`);

    const includeDead = process.argv.includes('--include-dead');
    const perOwnerSpecies = new Map();
    const docs = []; let skippedDead = 0, skippedOwner = 0;
    for (const [id, g] of [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
        const owner = L.mode(g.owners);
        if (!userIds.has(owner)) { skippedOwner++; continue; }
        const living = g.animals.filter(a => !a.deceasedDate);
        if (!living.length && !includeDead) { skippedDead++; continue; }
        const speciesList = [...new Set(g.animals.map(a => a.species).filter(Boolean))];
        const primary = L.mode(g.animals.map(a => a.species).filter(Boolean)) || 'Animal';
        const key = owner + '|' + primary;
        const n = (perOwnerSpecies.get(key) || 0) + 1; perOwnerSpecies.set(key, n);
        const text = (f) => L.mode(g.animals.map(a => a[f]).filter(v => typeof v === 'string' && v.trim()));
        docs.push({
            _id: L.oid(id), creatorId: L.oid(owner),
            name: `${primary} enclosure ${n}`.slice(0, 100),
            enclosureType: text('housingType') || '', bedding: text('bedding') || '', enrichment: text('enrichment') || '',
            purpose: living.length && living.every(a => a.isQuarantine) ? 'quarantine' : 'general',
            purposeDescription: '', buildingId: null, roomId: null, tags: ['reconstructed'], speciesLabels: speciesList,
            notes: 'Recreated after a database loss. The original name, size, location and supplies could not be recovered; please rename and update.',
            showDetailsOnPublicProfile: true,
            createdAt: L.idTime(id), updatedAt: new Date(), __v: 0,
        });
    }
    L.log(`  to create: ${docs.length} | skipped (only deceased animals): ${skippedDead} | skipped (owner not found): ${skippedOwner}`);
    L.log(`  owners: ${new Set(docs.map(d => String(d.creatorId))).size} | with housing type: ${docs.filter(d => d.enclosureType).length} | with bedding: ${docs.filter(d => d.bedding).length} | quarantine: ${docs.filter(d => d.purpose === 'quarantine').length}`);
    await L.insertByIds(Enclosure, docs, 'enclosures');
};
