// Third pass: apply the same strip policy (Go/-, B/-, Rst/-) to CTU114's remaining wildcards.
// Dry run by default; pass --apply to write changes.
require('dotenv').config();
const mongoose = require('mongoose');
const { Animal } = require('../database/models');

const APPLY = process.argv.includes('--apply');
const STRIP_TOKENS = ['Go/-', 'B/-', 'Rst/-'];

function cleanGeneticCode(code) {
  const tokens = code.split(/\s+/).filter(Boolean);
  return tokens.filter(t => !STRIP_TOKENS.includes(t)).join(' ');
}

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);

  const animals = await Animal.find({
    creatorId_public: 'CTU114',
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
