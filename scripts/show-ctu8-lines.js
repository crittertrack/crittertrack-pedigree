const mongoose = require('mongoose');
require('dotenv').config();
const { Animal, PublicProfile } = require('../database/models');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);

  const profile = await PublicProfile.findOne({ id_public: 'CTU8' }).lean();
  const defs = profile.breedingLineDefs || [];
  const lines = profile.animalBreedingLines || {};

  // Get all CTU8 animals for prefix lookup
  const animals = await Animal.find({ ownerId_public: 'CTU8' }).select('id_public prefix').lean();
  const prefixMap = {};
  for (const a of animals) prefixMap[a.id_public] = a.prefix || '(none)';

  // Group by line
  const byLine = {};
  for (const [animalId, lineIds] of Object.entries(lines)) {
    // Only include animals still on CTU8
    if (!prefixMap[animalId]) continue;
    for (const lid of lineIds) {
      if (!byLine[lid]) byLine[lid] = [];
      byLine[lid].push({ id: animalId, prefix: prefixMap[animalId] });
    }
  }

  for (const def of defs.filter(d => d.name)) {
    const group = byLine[def.id] || [];
    const prefixCounts = {};
    for (const a of group) prefixCounts[a.prefix] = (prefixCounts[a.prefix] || 0) + 1;
    const prefixList = Object.entries(prefixCounts).sort((a,b) => b[1]-a[1]).map(([p,c]) => `${p}(${c})`).join(', ');
    console.log(`\n${def.name} (${def.color}) — ${group.length} animals:`);
    console.log(`  ${prefixList}`);
  }

  // Unassigned
  const assignedIds = new Set(Object.keys(lines).filter(id => prefixMap[id]));
  const unassigned = animals.filter(a => !assignedIds.has(a.id_public));
  const uPrefixCounts = {};
  for (const a of unassigned) uPrefixCounts[a.prefix || '(none)'] = (uPrefixCounts[a.prefix || '(none)'] || 0) + 1;
  const uList = Object.entries(uPrefixCounts).sort((a,b) => b[1]-a[1]).map(([p,c]) => `${p}(${c})`).join(', ');
  console.log(`\nUNASSIGNED — ${unassigned.length} animals:`);
  console.log(`  ${uList}`);

  await mongoose.disconnect();
})();
