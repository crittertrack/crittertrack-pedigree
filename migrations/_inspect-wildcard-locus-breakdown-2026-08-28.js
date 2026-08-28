// Read-only report: breakdown of which specific loci carry the "/-" wildcard, and how often,
// restricted to CTU2 + CTU8 (the two bulk accounts).
require('dotenv').config();
const mongoose = require('mongoose');
const { Animal } = require('../database/models');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);

  const animals = await Animal.find({
    creatorId_public: { $in: ['CTU2', 'CTU8'] },
    geneticCode: { $regex: /\/-/ },
  }).select('id_public species geneticCode creatorId_public').lean();

  const locusCounts = {};
  for (const a of animals) {
    const tokens = a.geneticCode.split(/\s+/).filter(t => t.includes('/-'));
    for (const t of tokens) {
      const locus = t.split('/')[0];
      locusCounts[locus] = (locusCounts[locus] || 0) + 1;
    }
  }

  console.log(`Animals scanned: ${animals.length}\n`);
  console.log('Locus token counts (e.g. "Go" = "Go/-" appeared this many times):');
  Object.entries(locusCounts).sort((a, b) => b[1] - a[1]).forEach(([locus, count]) => {
    console.log(`  ${locus}: ${count}`);
  });

  await mongoose.disconnect();
})();
