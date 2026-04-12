const mongoose = require('mongoose');
require('dotenv').config();
const { Animal, PublicProfile } = require('../database/models');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);

  const profile = await PublicProfile.findOne({ id_public: 'CTU8' });
  const abl = profile.animalBreedingLines || {};
  const test4Ids = Object.entries(abl).filter(([, lines]) => lines.includes(3)).map(([id]) => id);

  const animals = await Animal.find({ id_public: { $in: test4Ids } }).select('id_public prefix name').lean();

  // Derive prefix from name if prefix field is empty
  const getEffectivePrefix = (a) => {
    if (a.prefix) return a.prefix;
    const match = (a.name || '').match(/^([A-Za-z][A-Za-z0-9']*(?:'s)?)\s/);
    return match ? match[1] : '(none)';
  };

  const prefixes = {};
  for (const a of animals) {
    const p = getEffectivePrefix(a);
    if (!prefixes[p]) prefixes[p] = [];
    prefixes[p].push(a);
  }

  // Check for TnS specifically
  const tns = animals.filter(a => (a.name || '').startsWith('TnS'));
  console.log(`TnS animals in test 4 (by name): ${tns.length}`);
  console.log(`TnS animals with prefix field set: ${tns.filter(a => a.prefix === 'TnS').length}`);
  console.log(`TnS animals with empty/missing prefix: ${tns.filter(a => !a.prefix).length}`);
  
  console.log(`\nTest 4 animals: ${test4Ids.length} (found in DB: ${animals.length})`);
  console.log(`\nBy prefix field:`);
  const byPrefix = {};
  for (const a of animals) {
    const p = a.prefix || '(no prefix field)';
    byPrefix[p] = (byPrefix[p] || 0) + 1;
  }
  for (const [p, c] of Object.entries(byPrefix).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${p}: ${c}`);
  }

  await mongoose.disconnect();
})();
