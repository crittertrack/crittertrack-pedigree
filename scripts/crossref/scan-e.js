'use strict';
/** READ-ONLY: can the corrupted health-record arrays ({"0":"[","1":"{",...}) be repaired exactly? */
const fs = require('fs');
const animals = JSON.parse(fs.readFileSync('C:/Projects/backups_auto-backup-2026-11-10T03-00-00_animals.json', 'utf8'));
const FIELDS = ['vaccinations', 'dewormingRecords', 'parasiteControl', 'medicalConditions', 'allergies', 'medications', 'medicalProcedures', 'labResults', 'vetVisits'];
const isCharMap = (o) => o && typeof o === 'object' && '0' in o && typeof o['0'] === 'string' && o['0'].length === 1;
const rebuild = (o) => { const keys = Object.keys(o).filter(k => /^\d+$/.test(k)).sort((a, b) => a - b); return keys.map(k => o[k]).join(''); };
let bad = 0, fixed = 0, failed = 0; const ex = [];
for (const a of animals) for (const f of FIELDS) {
    const arr = a[f]; if (!Array.isArray(arr) || !arr.some(isCharMap)) continue;
    bad++;
    try {
        const parts = arr.map(x => isCharMap(x) ? JSON.parse(rebuild(x)) : [x]).flat();
        fixed++; if (ex.length < 3) ex.push({ id: a.id_public, field: f, was: arr.length + ' char-maps', now: JSON.stringify(parts).slice(0, 160), extraKeys: Object.keys(arr[0]).filter(k => !/^\d+$/.test(k)) });
    } catch (e) { failed++; ex.push({ id: a.id_public, field: f, error: e.message, sample: rebuild(arr[0]).slice(0, 80) }); }
}
console.log('corrupted arrays:', bad, '| repairable:', fixed, '| failed:', failed);
ex.forEach(e => console.log(JSON.stringify(e)));
console.log('animals affected:', new Set(animals.filter(a => FIELDS.some(f => Array.isArray(a[f]) && a[f].some(isCharMap))).map(a => a.id_public)).size);
const pub = JSON.parse(fs.readFileSync('C:/Projects/backups_auto-backup-2026-11-10T03-00-00_publicAnimals.json', 'utf8'));
console.log('same corruption in publicAnimals:', pub.filter(a => FIELDS.some(f => Array.isArray(a[f]) && a[f].some(isCharMap))).length);
