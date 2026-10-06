/**
 * Fix Latin names missing a starting capital (start letter only).
 * Usage: node debug/fix_latin_capitals.js [--apply]
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { MongoClient } = require('mongodb');

const APPLY = process.argv.includes('--apply');

(async () => {
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const db = client.db();

  const bad = await db.collection('species').find({ latinName: { $regex: '^[a-z]' } }).toArray();
  console.log(`Latin names missing starting capital: ${bad.length}`);
  bad.forEach(s => {
    const fixed = s.latinName[0].toUpperCase() + s.latinName.slice(1);
    console.log(`- "${s.name}": "${s.latinName}" -> "${fixed}"`);
  });

  if (!APPLY) { console.log('\nDRY RUN — re-run with --apply.'); await client.close(); return; }

  for (const s of bad) {
    const fixed = s.latinName[0].toUpperCase() + s.latinName.slice(1);
    await db.collection('species').updateOne({ _id: s._id }, { $set: { latinName: fixed } });
  }

  const left = await db.collection('species').countDocuments({ latinName: { $regex: '^[a-z]' } });
  console.log(`\nVerify: latin names still starting lowercase = ${left} ${left === 0 ? '(OK)' : '(FAILED)'}`);
  if (left !== 0) process.exit(1);

  await client.close();
})().catch(err => { console.error(err); process.exit(1); });
