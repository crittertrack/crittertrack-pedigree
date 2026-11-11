'use strict';
/**
 * READ-ONLY: every top-level field in the 4 backup files, how many docs carry real data in it, and a sample.
 * Skips fields we have already used. Output is sorted so embedded arrays/objects (likely "shadows" of
 * missing collections) are easy to spot. No DB access.
 */
const fs = require('fs');
const P = (k) => JSON.parse(fs.readFileSync(`C:/Projects/backups_auto-backup-2026-11-10T03-00-00_${k}.json`, 'utf8'));
const which = process.argv[2] || 'animals';
const docs = P(which);
const has = (v) => v !== null && v !== undefined && v !== '' && v !== false && v !== 0 && !(Array.isArray(v) && !v.length) && !(typeof v === 'object' && !Array.isArray(v) && !Object.keys(v).length);
const kind = (v) => Array.isArray(v) ? 'array' : (v && typeof v === 'object' ? 'object' : typeof v);
const rows = {};
for (const d of docs) for (const [k, v] of Object.entries(d)) {
    const r = rows[k] || (rows[k] = { n: 0, kind: kind(v), sample: undefined, uniq: new Set() });
    if (has(v)) { r.n++; if (r.sample === undefined) r.sample = v; if (r.uniq.size < 400) r.uniq.add(JSON.stringify(v)); }
}
const skip = new Set(['_id', '__v', 'createdAt', 'updatedAt']);
const out = Object.entries(rows).filter(([k, r]) => !skip.has(k) && r.n > 0).sort((a, b) => (a[1].kind === 'array' || a[1].kind === 'object' ? 0 : 1) - (b[1].kind === 'array' || b[1].kind === 'object' ? 0 : 1) || b[1].n - a[1].n);
console.log(`${which}: ${docs.length} docs, ${out.length} fields with data`);
for (const [k, r] of out) {
    const s = JSON.stringify(r.sample); console.log(`${k.padEnd(34)} ${r.kind.padEnd(7)} n=${String(r.n).padEnd(5)} uniq=${String(r.uniq.size >= 400 ? '400+' : r.uniq.size).padEnd(5)} ${s && s.length > 110 ? s.slice(0, 110) + '…' : s}`);
}
