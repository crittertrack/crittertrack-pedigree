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

  const target = await animals.findOne({ id_public: 'CTC6917' });
  if (!target) { console.error('CTC6917 not found'); process.exit(1); }

  // find siblings (same sire and dam, excluding itself)
  const siblings = await animals.find({
    sireId_public: target.sireId_public,
    damId_public: target.damId_public,
    id_public: { $ne: 'CTC6917' }
  }, { projection: { id_public: 1 } }).toArray();

  const siblingIds = siblings.map(s => s.id_public);
  console.log('Siblings:', siblingIds);

  // children of siblings
  let allIds = [...siblingIds];
  for (const sid of siblingIds) {
    const kids = await animals.find(
      { $or: [{ sireId_public: sid }, { damId_public: sid }] },
      { projection: { id_public: 1 } }
    ).toArray();
    allIds = allIds.concat(kids.map(k => k.id_public));
  }
  allIds = [...new Set(allIds)];

  const assignments = user.animalBreedingLines || {};
  for (const id of allIds) {
    const prev = assignments[id] || [];
    if (!prev.includes(3)) assignments[id] = [...prev, 3];
  }

  await users.updateOne({ _id: user._id }, { $set: { animalBreedingLines: assignments } });
  console.log('Updated', allIds.length, 'animals (siblings + their children)');
  await client.close();
}
main().catch(e => { console.error(e); process.exit(1); });