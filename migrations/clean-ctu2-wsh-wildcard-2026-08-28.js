// Fourth pass: map CTU2's remaining Wsh/- wildcard to Wsh/w.
// Dry run by default; pass --apply to write changes.
require('dotenv').config();
const mongoose = require('mongoose');
const { Animal } = require('../database/models');

const APPLY = process.argv.includes('--apply');
const REPLACE_TOKENS = { 'Wsh/-': 'Wsh/w' };

function cleanGeneticCode(code) {
  const tokens = code.split(/\s+/).filter(Boolean);
  return tokens.map(t => (REPLACE_TOKENS[t] ? REPLACE_TOKENS[t] : t)).join(' ');
}

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);

  const animals = await Animal.find({
    creatorId_public: 'CTU2',
    geneticCode: { $regex: /\/-/ },
  }).select('id_public name geneticCode').lean();

  const changes = [];
  for (const a of animals) {
    const newCode = cleanGeneticCode(a.geneticCode);
    if (newCode !== a.geneticCode) {
      changes.push({ _id: a._id, id_public: a.id_public, name: a.name, before: a.geneticCode, after: newCode });
    }
  }

  console.log(`Animals with a change to apply: ${changes.length}\n`);
  changes.forEach(c => {
    console.log(`  ${c.id_public} "${c.name}"`);
    console.log(`     before: ${c.before}`);
    console.log(`     after:  ${c.after}`);
  });

  if (APPLY && changes.length > 0) {
    const bulkOps = changes.map(c => ({
      updateOne: { filter: { _id: c._id }, update: { $set: { geneticCode: c.after } } },
    }));
    const result = await Animal.bulkWrite(bulkOps);
    console.log('\nModified count:', result.modifiedCount);
  } else if (!APPLY) {
    console.log('\nDry run only — pass --apply to write changes.');
  }

  await mongoose.disconnect();
})();
