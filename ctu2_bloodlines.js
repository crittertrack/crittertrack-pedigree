require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });
const { MongoClient } = require('mongodb');

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) { console.error('MONGODB_URI not set'); process.exit(1); }
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(process.env.MONGODB_DB_NAME || undefined);
  const animals = db.collection('animals');

  const owned = await animals.find({ creatorId_public: 'CTU2', isOwned: true }, {
    projection: { id_public: 1, name: 1, prefix: 1, suffix: 1, sireId_public: 1, damId_public: 1 }
  }).toArray();

  console.log('Owned CTU2 animals:', owned.length);

  const byId = new Map();
  const cursor = animals.find({}, { projection: { id_public: 1, sireId_public: 1, damId_public: 1, name: 1, prefix: 1 } });
  for await (const d of cursor) byId.set(d.id_public, d);

  const rootsOf = (id, seen = new Set()) => {
    const a = byId.get(id);
    if (!a) return [id];
    const parents = [a.sireId_public, a.damId_public].filter(Boolean);
    if (parents.length === 0) return [id];
    const roots = [];
    for (const p of parents) {
      if (seen.has(p)) continue;
      seen.add(p);
      roots.push(...rootsOf(p, seen));
    }
    return roots;
  };

  const lines = new Map();
  for (const a of owned) {
    const roots = [...new Set(rootsOf(a.id_public))].sort();
    const key = roots.join('|');
    if (!lines.has(key)) lines.set(key, []);
    lines.get(key).push(a);
  }

  console.log('\nNumber of separate bloodlines:', lines.size);
  console.log('='.repeat(60));
  let i = 1;
  for (const [key, members] of lines) {
    console.log(`\nBloodline ${i++}: roots = ${key}`);
    console.log(`  owned descendants: ${members.length}`);
    for (const m of members) {
      const label = [m.prefix, m.name, m.suffix].filter(Boolean).join(' ');
      console.log(`   - ${m.id_public}  ${label}`);
    }
  }

  await client.close();
}
main().catch(e => { console.error(e); process.exit(1); });
