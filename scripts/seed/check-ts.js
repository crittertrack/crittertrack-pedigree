'use strict';
// READ-ONLY: which animals differ in updatedAt from the merged backup, and were they part of the link step?
const L = require('./lib');
const fs = require('fs');
(async () => {
    await L.mongoose.connect(process.env.MONGODB_URI);
    const d = L.mongoose.connection.db;
    const bu = new Map(JSON.parse(fs.readFileSync('C:/Projects/merged-backup/backups_auto-backup-2026-11-10T03-00-00_animals.json', 'utf8')).map(a => [String(a._id), a]));
    const linkedNow = new Set(JSON.parse(fs.readFileSync('C:/Projects/recovery-reports/link-offspring-rollback.json', 'utf8')).map(x => x.animalId));
    const animals = await d.collection('animals').find({}).toArray();
    for (const a of animals) {
        const b = bu.get(String(a._id)); if (!b) { console.log('not in backup:', a.id_public); continue; }
        if (b.updatedAt && a.updatedAt && new Date(b.updatedAt).getTime() !== new Date(a.updatedAt).getTime()) {
            const diffKeys = Object.keys(a).filter(k => k !== 'updatedAt' && JSON.stringify(a[k]) !== JSON.stringify(b[k]) && !(a[k] instanceof Date && new Date(b[k]).getTime() === a[k].getTime()) && String(a[k]) !== String(b[k]));
            console.log(a.id_public, '| db updatedAt', a.updatedAt.toISOString(), '| backup', b.updatedAt, '| in my link step:', linkedNow.has(String(a._id)), '| other differing fields:', diffKeys.join(',') || 'none');
        }
    }
    await L.mongoose.disconnect();
})().catch(e => { console.error(e); process.exit(1); });
