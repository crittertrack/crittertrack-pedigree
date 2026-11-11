'use strict';
// READ-ONLY. Compares CTU2 animals' mating/planned flags across the old backups.
const fs = require('fs');
const files = [
  'C:\\Projects\\auto-backup-2026-11-02T03-00-00.json',
  'C:\\Projects\\auto-backup-2026-11-03T03-00-00.json',
  'C:\\Projects\\backups_auto-backup-2026-11-10T03-00-00_animals.json',
];
const watch = ['CTC7467','CTC7589','CTC7688','CTC7773','CTC6632','CTC7650','CTC6177','CTC5484','CTC6261'];
for (const f of files) {
  console.log('\n===', f.split('\\').pop());
  const raw = JSON.parse(fs.readFileSync(f, 'utf8'));
  let animals = Array.isArray(raw) ? raw : (raw.animals || raw.data?.animals || raw.collections?.animals);
  if (!animals) { console.log('top-level keys:', Object.keys(raw).slice(0, 15).join(', ')); continue; }
  const ctu2 = animals.filter(a => a.creatorId_public === 'CTU2');
  const planned = ctu2.filter(a => a.isPlannedMating);
  const mating = ctu2.filter(a => a.isInMating);
  console.log('CTU2 animals:', ctu2.length, '| planned:', planned.length, '| inMating:', mating.length);
  const nm = a => `${a.id_public} ${[a.prefix, a.name].filter(Boolean).join(' ')}`;
  console.log('planned males  :', planned.filter(a => a.gender === 'Male').map(nm).join(' ; ') || '-');
  console.log('planned females:', planned.filter(a => a.gender === 'Female').map(nm).join(' ; ') || '-');
  console.log('inMating males :', mating.filter(a => a.gender === 'Male').map(nm).join(' ; ') || '-');
  console.log('watched animals:', ctu2.filter(a => watch.includes(a.id_public)).map(a => `${a.id_public}:${a.isPlannedMating ? 'P' : ''}${a.isInMating ? 'M' : ''}`).join(' '));
}
