/**
 * List every species grouped by assigned category so we can eyeball mismatches.
 * Usage: node debug/check_categories.js
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { MongoClient } = require('mongodb');

(async () => {
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const db = client.db();

  const species = await db.collection('species').find({}).sort({ category: 1, name: 1 }).toArray();
  const byCat = {};
  for (const s of species) {
    (byCat[s.category || 'NONE'] = byCat[s.category || 'NONE'] || []).push(s);
  }
  for (const [cat, list] of Object.entries(byCat)) {
    console.log(`\n=== ${cat} (${list.length}) ===`);
    list.forEach(s => console.log(`- ${s.name}${s.latinName ? ` | ${s.latinName}` : ''}`));
  }

  await client.close();
})().catch(err => { console.error(err); process.exit(1); });
