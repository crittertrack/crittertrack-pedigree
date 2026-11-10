'use strict';
/** READ-ONLY scan of the 11-10 backup (part B): enclosures + waitlists. No DB access. */
const fs = require('fs');
const P = (k) => JSON.parse(fs.readFileSync(`C:/Projects/backups_auto-backup-2026-11-10T03-00-00_${k}.json`, 'utf8'));
const animals = P('animals'), pub = P('publicAnimals'), profiles = P('publicProfiles');
const uniq = (a) => [...new Set(a)];
const day = (d) => (d ? String(d).slice(0, 10) : '');
const has = (v) => v !== null && v !== undefined && v !== '';

console.log('=== C. ENCLOSURES ===');
const enc = animals.filter(a => a.enclosureId);
const groups = new Map(); enc.forEach(a => { if (!groups.has(a.enclosureId)) groups.set(a.enclosureId, []); groups.get(a.enclosureId).push(a); });
console.log('animals with enclosureId:', enc.length, '| unique enclosures:', groups.size, '| publicAnimals with it:', pub.filter(a => a.enclosureId).length, 'unique:', uniq(pub.filter(a => a.enclosureId).map(a => a.enclosureId)).length);
console.log('enclosures shared by >1 owner:', [...groups.values()].filter(g => uniq(g.map(a => String(a.creatorId))).length > 1).length);
['housingType', 'bedding', 'humidity', 'lighting', 'temperatureRange', 'enrichment', 'quarantineDetails', 'colonyId'].forEach(k => console.log('  animals-in-enclosure with', k.padEnd(18), enc.filter(a => has(a[k])).length));
[...groups.entries()].sort((a, b) => b[1].length - a[1].length).slice(0, 4).forEach(([id, g]) => console.log('  ', id, '| animals', g.length, '| owner', g[0].creatorId_public, '| species', uniq(g.map(a => a.species)).join('/'), '| housing', uniq(g.map(a => a.housingType)).filter(Boolean).join('|'), '| bedding', uniq(g.map(a => a.bedding)).filter(Boolean).join('|')));
console.log('  size distribution (animals: enclosures):', JSON.stringify([...groups.values()].reduce((c, g) => { const k = Math.min(g.length, 10); c[k] = (c[k] || 0) + 1; return c; }, {})));
console.log('  enclosures where every animal is deceased:', [...groups.values()].filter(g => g.every(a => a.deceasedDate)).length);
console.log('  owners with enclosures:', uniq(enc.map(a => a.creatorId_public)).length, '| per-owner counts top:', JSON.stringify(Object.entries(enc.reduce((c, a) => { c[a.creatorId_public] = (c[a.creatorId_public] || 0) + 1; return c; }, {})).sort((a, b) => b[1] - a[1]).slice(0, 5)));

console.log('\n=== D. WAITLISTS ===');
const res = animals.filter(a => a.reservedBuyerName || a.reservedWaitlistEntryId || a.reservedPrice);
const wl = new Map(); animals.filter(a => a.reservedWaitlistEntryId).forEach(a => { if (!wl.has(a.reservedWaitlistEntryId)) wl.set(a.reservedWaitlistEntryId, []); wl.get(a.reservedWaitlistEntryId).push(a); });
console.log('animals with reserved* data:', res.length, '| with reservedWaitlistEntryId:', [...wl.values()].flat().length, '| unique waitlist entries:', wl.size);
['reservedBuyerName', 'reservedBuyerContact', 'reservedPrice', 'reservedPriceCurrency', 'reservedDeposit', 'reservedDepositStatus', 'reservedPaymentStatus', 'reservedDate', 'reservedWaitlistEntryId'].forEach(k => console.log('  reserved animals with', k.padEnd(25), res.filter(a => has(a[k])).length));
let agree = 0, multiOwner = 0; wl.forEach(g => { if (uniq(g.map(a => a.reservedBuyerName)).length === 1) agree++; if (uniq(g.map(a => String(a.creatorId))).length > 1) multiOwner++; });
console.log('  entries where all animals agree on buyer:', agree, 'of', wl.size, '| entries spanning >1 owner:', multiOwner);
[...wl.entries()].slice(0, 4).forEach(([id, g]) => console.log('  ', id, '| owner', g[0].creatorId_public, '| buyer', uniq(g.map(a => a.reservedBuyerName)).join('|'), '| contact', uniq(g.map(a => a.reservedBuyerContact)).filter(Boolean).join('|'), '| animals', g.map(a => a.id_public + '(' + a.species + ',' + a.gender + ')').join(' '), '| date', uniq(g.map(a => day(a.reservedDate))).join('|')));
console.log('  reserved-with-no-entry-id animals:', res.filter(a => !a.reservedWaitlistEntryId).length, '| reserved and already sold:', res.filter(a => a.soldStatus === 'sold').length);
console.log('  publicProfiles with waitlistInfo text:', profiles.filter(p => p.waitlistInfo).length);
