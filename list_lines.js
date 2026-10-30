require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });
const { MongoClient } = require('mongodb');

async function main() {
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const db = client.db(process.env.MONGODB_DB_NAME || undefined);
  const users = db.collection('users');
  const animals = db.collection('animals');

  const user = await users.findOne({ id_public: 'CTU2' });
  const defs = (user.breedingLineDefs || []).slice(0, 4);
  const assignments = user.animalBreedingLines || {};

  // map animal id -> name
  const ids = Object.keys(assignments);
  const docs = await animals.find({ id_public: { $in: ids } }, { projection: { id_public: 1, name: 1, prefix: 1 } }).toArray();
  const nameMap = {};
  for (const d of docs) nameMap[d.id_public] = [d.prefix, d.name].filter(Boolean).join(' ');

  // all owned animals
  const owned = await animals.find({ creatorId_public: 'CTU2', isOwned: true }, { projection: { id_public: 1, name: 1, prefix: 1 } }).toArray();
  const allIds = new Set(owned.map(a => a.id_public));
  const assignedIds = new Set();
  for (const line of [0,1,2,3]) {
    const lineDefs = defs[line];
    console.log(`\nLine ${line + 1} (${lineDefs?.name || 'unnamed'}):`);
    const members = Object.entries(assignments).filter(([id, lines]) => Array.isArray(lines) && lines.includes(line)).map(([id]) => id);
    for (const id of members) { assignedIds.add(id); console.log('  - ' + (nameMap[id] || id)); }
    if (members.length === 0) console.log('  (none)');
  }

  console.log('\nUnassigned:');
  for (const a of owned) {
    if (!assignedIds.has(a.id_public)) console.log('  - ' + [a.prefix, a.name].filter(Boolean).join(' '));
  }

  await client.close();
}
main().catch(e => { console.error(e); process.exit(1); });