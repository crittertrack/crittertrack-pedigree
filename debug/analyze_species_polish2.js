/**
 * Follow-up audit: title-case inconsistencies in common names (words after the
 * first that are lowercase), plus context for the custom-species decisions.
 *
 * Usage: node debug/analyze_species_polish2.js
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { MongoClient } = require('mongodb');

const SMALL_WORDS = new Set(['and', 'or', 'of', 'the', 'x', 'sp']);

(async () => {
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const db = client.db();

  const species = await db.collection('species').find({}).sort({ isDefault: -1, name: 1 }).toArray();

  // Mixed-case common names: some word (not a small connector word) starts lowercase
  const mixed = [];
  for (const s of species) {
    const words = s.name.split(/\s+/);
    const badWords = words.slice(1).filter(w =>
      /^[a-z]/.test(w) && !SMALL_WORDS.has(w.toLowerCase()) && !/^\(/.test(w));
    if (badWords.length && /^[A-Z]/.test(s.name)) {
      mixed.push({ name: s.name, badWords, isDefault: s.isDefault });
    }
  }
  console.log('=== Common names with lowercase words mid-name: ' + mixed.length + ' ===');
  mixed.forEach(m => console.log('- "' + m.name + '" ' + (m.isDefault ? '(default)' : '(custom)') + ' — lowercase: ' + m.badWords.join(', ')));

  // Context: animals using each custom species
  console.log('\n=== Animals on custom species ===');
  const customs = species.filter(s => !s.isDefault);
  for (const s of customs) {
    const animals = await db.collection('animals').find(
      { species: { $regex: '^' + s.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', $options: 'i' } },
      { projection: { _id: 0, id_public: 1, name: 1, creatorId_public: 1, archived: 1 } }
    ).toArray();
    const list = animals.length
      ? animals.map(a => a.id_public + ' "' + a.name + '" (' + (a.archived ? 'archived' : 'active') + ')').join(', ')
      : 'none';
    console.log('- "' + s.name + '": ' + list);
  }

  // Context: existing invertebrate default naming conventions
  console.log('\n=== Existing invertebrate default naming conventions ===');
  species.filter(s => s.isDefault && s.category === 'Invertebrate').forEach(s =>
    console.log('- "' + s.name + '" | ' + (s.latinName || '—')));

  await client.close();
})().catch(err => { console.error(err); process.exit(1); });
