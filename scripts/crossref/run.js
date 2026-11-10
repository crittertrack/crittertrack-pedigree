#!/usr/bin/env node
'use strict';
/**
 * READ-ONLY cross-reference analysis of the four primary 2026-11-10 backup files.
 * Usage: node scripts/crossref/run.js
 * Output: C:\Projects\recovery-reports\ (report .md + derived candidate .json). Never touches MongoDB.
 */
const c = require('./ctx');
require('./part1-catalog');
require('./part2a-litters');
require('./part2b-litters');
require('./part2c-quality');
require('./part3-counters-species');
require('./part4-transfers');
require('./part5-users');
require('./part6-inconsistencies');

const { P, table, F, path, sha, hashesBefore, fs, OUT, shared, s } = c;
P('## 11. Leads outside the four files (not inspected here)');
P();
P('- `C:\\Projects\\pre-restore-snapshot-1793752772870.json` (1.4 MB, 2026-11-04) and `crittertrack-pedigree\\scripts\\restore-sale-state-from-backup.js` exist and may hold sale-state data.');
P('- `C:\\Projects\\auto-backup-2026-11-02/03*.json`: older snapshots of the same four collections (see earlier merge).');
P('- backup-info says `storageLocation: r2`: the R2 bucket may hold additional/older backup objects.');
P();

const after = Object.fromEntries(Object.entries(F).map(([k, p]) => [k, sha(p)]));
const same = Object.keys(F).every(k => after[k] === hashesBefore[k].sha256);
P('## 12. Evidence integrity (SHA-256 re-checked after analysis)');
P();
table(['File', 'Unchanged'], Object.keys(F).map(k => [path.basename(F[k]), after[k] === hashesBefore[k].sha256 ? 'YES (identical hash)' : 'CHANGED!']));
P(same ? '**All four originals plus backup-info are byte-identical after analysis.**' : '**WARNING: a source file changed!**');

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'cross-reference-report-2026-11-10.md'), c.md.join('\n'));
const { L, ownedOrphans, ownedLit, unlinkedSets } = shared;
fs.writeFileSync(path.join(OUT, 'litter-reconstruction-candidates-2026-11-10.json'), JSON.stringify({
    note: 'DERIVED, UNVERIFIED candidates from backups. Not written to any database.',
    litters: L.map(g => ({ litterObjectId: g.lid, creatorId: g.creatorId, creatorId_public: g.creatorPub, sireId_public: g.sire, damId_public: g.dam, birthDate: g.birth, matingDate: g.mating, litter_id_public: g.ctl, species: g.species, offspringIds_public: g.offspring, genderCounts: g.genders, inUserOwnedLitters: g.inOwned })),
    ownedLittersWithNoAnimals: ownedOrphans.map(k => ({ litterObjectId: k, ownerPublicIds: ownedLit.get(k) })),
    candidateLittersWithoutLitterId: unlinkedSets.map(([k, v]) => ({ key: k, offspringIds_public: v })),
}, null, 1));
console.log('Report written to', OUT, '| sources unchanged:', same);
