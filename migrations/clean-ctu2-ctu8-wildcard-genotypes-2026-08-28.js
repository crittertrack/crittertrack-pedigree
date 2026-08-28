// Cleans up legacy "/-" wildcard tokens in geneticCode for CTU2 + CTU8 only:
//   Go/-, E/-, P/-, B/-, D/-, Rst/-, Sa/-, C/-, S/-  -> removed entirely
//   A/-                                              -> replaced with A/a
// Dry run by default; pass --apply to write changes.
require('dotenv').config();
const mongoose = require('mongoose');
const { Animal } = require('../database/models');

const APPLY = process.argv.includes('--apply');

const STRIP_TOKENS = ['Go/-', 'E/-', 'P/-', 'B/-', 'D/-', 'Rst/-', 'Sa/-', 'C/-', 'S/-'];
const REPLACE_TOKENS = { 'A/-': 'A/a' };

function cleanGeneticCode(code) {
  const tokens = code.split(/\s+/).filter(Boolean);
  const newTokens = tokens
    .filter(t => !STRIP_TOKENS.includes(t))
    .map(t => (REPLACE_TOKENS[t] ? REPLACE_TOKENS[t] : t));
  return newTokens.join(' ');
}

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);

  const animals = await Animal.find({
    creatorId_public: { $in: ['CTU2', 'CTU8'] },
    geneticCode: { $regex: /\/-/ },
  }).select('id_public name species geneticCode creatorId_public').lean();

  console.log(`Animals matched: ${animals.length}\n`);

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
