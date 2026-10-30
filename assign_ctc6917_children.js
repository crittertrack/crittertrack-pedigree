require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });
const { MongoClient } = require('mongodb');

async function main() {
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const db = client.db(process.env.MONGODB_DB_NAME || undefined);
  const users = db.collection('users');
  const animals = db.collection('animals');

  const user = await users.findOne({ id_public: 'CTU2' });
  if (!user) { console.error('CTU2 user not found'); process.exit(1); }

  const children = await animals.find(
    { $or: [{ sireId_public: 'CTC6917' }, { damId_public: 'CTC6917' }] },
    { projection: { id_public: 1 } }
  ).toArray();

  const ids = children.map(c => c.id_public);
  console.log('Children:', ids);

  const assignments = user.animalBreedingLines || {};
  for (const id of ids) {
    const prev = assignments[id] || [];
    if (!prev.includes(3)) assignments[id] = [...prev, 3];
  }

  await users.updateOne({ _id: user._id }, { $set: { animalBreedingLines: assignments } });
  console.log('Updated', ids.length, 'children');
  await client.close();
}
main().catch(e => { console.error(e); process.exit(1); });