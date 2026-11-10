'use strict';
const c = require('./ctx');
const { P, table, s, uniq, short, countBy, empty, users, animals, publicAnimals } = c;
const ctl = c.shared.ctl;

P('## 6. Counters (collection `counters`)');
P();
const nums = (re, arr) => arr.map(x => s(x.id_public)).filter(x => re.test(x)).map(x => parseInt(x.slice(3), 10));
const cu = nums(/^CTU\d+$/, users), ca = nums(/^CTC\d+$/, animals), cpa = nums(/^CTC\d+$/, publicAnimals);
const absent = (arr) => { const set = new Set(arr); const m = []; const mx = arr.reduce((a, b) => Math.max(a, b), 0); for (let i = 1; i <= mx; i++) if (!set.has(i)) m.push(i); return m; };
const mu = absent(cu), ma = absent(ca);
const blocks = (arr) => { const b = []; let st = null, pv = null; for (const n of arr) { if (st === null) { st = n; pv = n; } else if (n === pv + 1) pv = n; else { if (pv - st >= 19) b.push(`${st}-${pv}`); st = n; pv = n; } } if (st !== null && pv - st >= 19) b.push(`${st}-${pv}`); return b; };
table(['Counter', 'Highest id_public in backup', 'Unique present', 'Absent in 1..max', 'Restored seq', 'Comment'], [
    ['userId', cu.reduce((a, b) => Math.max(a, b), 0), uniq(cu).length, mu.length, 170, 'gaps = deleted accounts or ids never issued'],
    ['animalId', ca.reduce((a, b) => Math.max(a, b), 0), uniq(ca).length, ma.length, 9336, 'gaps = deleted/merged animals; value is a LOWER BOUND of the real counter'],
    ['litterId', `none (${ctl.length} CTL ids in backup)`, '-', '-', 1000, 'UNKNOWN; set to schema default. Real value unrecoverable from these files.'],
]);
P(`- Highest CTC in publicAnimals: ${cpa.reduce((a, b) => Math.max(a, b), 0)} (animals: ${ca.reduce((a, b) => Math.max(a, b), 0)}).`);
P(`- First absent animal numbers: ${ma.slice(0, 15).join(', ')}${ma.length > 15 ? '…' : ''}; contiguous gap blocks of 20+: ${blocks(ma).slice(0, 15).join(', ') || 'none'}`);
P();

P('## 7. Species and genetics');
P();
const sp = countBy(animals.map(a => s(a.species)));
const spPub = countBy(publicAnimals.map(a => s(a.species)));
P(`- Distinct \`animals.species\` strings: **${Object.keys(sp).length}** (publicAnimals: ${Object.keys(spPub).length}). Animals have **no species ObjectId**; species are free text, so \`species\` collection documents are not referenced by id anywhere: only names are recoverable.`);
P();
table(['Species', 'Animals', 'PublicAnimals', 'With geneticCode', 'With carrierTraits/possibleHets'],
    Object.entries(sp).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, v, spPub[k] || 0,
        animals.filter(a => s(a.species) === k && a.geneticCode).length,
        animals.filter(a => s(a.species) === k && (a.carrierTraits || !empty(a.possibleHets))).length]));
const gcs = animals.filter(a => a.geneticCode);
P(`- Animals with non-empty \`geneticCode\`: **${gcs.length}**; unique code strings: **${uniq(gcs.map(a => a.geneticCode)).length}**; e.g. \`${short(gcs[0] && gcs[0].geneticCode, 80)}\``);
P(`- \`possibleHets\` non-empty: ${animals.filter(a => !empty(a.possibleHets)).length}; \`carrierTraits\` non-empty: ${animals.filter(a => !empty(a.carrierTraits)).length}.`);
P('- No ids of user genetics submissions, GeneticsData documents or feedback appear in the four files. Each animal retains its own genetic data; the genetics lookup tables are code/seed-derived and should be re-seeded rather than recovered.');
P();
