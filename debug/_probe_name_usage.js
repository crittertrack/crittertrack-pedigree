/** Counts animals/publicanimals per species name (exact, case-insensitive). */
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { MongoClient } = require('mongodb');

(async () => {
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const db = client.db();
  const names = ['kigoma baboon', 'pumpkin patch', 'Bronze baboon', 'Deer mouse', 'Green iguana',
    'Pill millipede', 'Plum isopod', 'Roly-Poly isopod', 'Mexican blood leg', 'Thai purple zebra',
    'red island birdeater', 'Whitetail Antsangy', 'Rabbit (Domesticated)'];
  for (const n of names) {
    const esc = n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const a = await db.collection('animals').countDocuments({ species: { $regex: '^' + esc + '$', $options: 'i' } });
    const p = await db.collection('publicanimals').countDocuments({ species: { $regex: '^' + esc + '$', $options: 'i' } });
    const af = await db.collection('appearancefieldoptions').countDocuments({ species: { $regex: '^' + esc + '$', $options: 'i' } });
    console.log(`${n}: animals=${a} public=${p} appearanceOptions=${af}`);
  }
  await client.close();
})().catch(err => { console.error(err); process.exit(1); });
