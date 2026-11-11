'use strict';
const fs = require('fs');
const u = JSON.parse(fs.readFileSync('C:/Projects/backups_auto-backup-2026-11-10T03-00-00_users.json', 'utf8'));
const owned = [];
u.forEach(u => (u.ownedLitters || []).forEach(l => owned.push(l)));
console.log('total ownedLitters entries:', owned.length);
console.log('unique IDs:', new Set(owned).size);
console.log('sample entries:', owned.slice(0, 5).map(l => l).join(', '));