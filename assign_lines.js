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

  const all = await animals.find({}, { projection: { id_public: 1, sireId_public: 1, damId_public: 1 } }).toArray();
  const byId = new Map(all.map(a => [a.id_public, a]));
  const owned = await animals.find({ creatorId_public: 'CTU2', isOwned: true }, { projection: { id_public: 1, sireId_public: 1, damId_public: 1 } }).toArray();

  const ancestorsOf = (id) => {
    const s = new Set(); const st = [id]; const seen = new Set();
    while (st.length) {
      const x = st.pop(); const a = byId.get(x); if (!a) continue;
      for (const p of [a.sireId_public, a.damId_public].filter(Boolean)) if (!seen.has(p)) { seen.add(p); s.add(p); st.push(p); }
    }
    return s;
  };

  const REMOVE = new Set([8, 9, 10]);
  const assignments = user.animalBreedingLines || {};
  const sundaeMirabel = new Set(['CTC46', 'CTC43']);

  for (const o of owned) {
    const aa = byId.get(o.id_public);
    const hasParent = aa && [aa.sireId_public, aa.damId_public].filter(Boolean).some(p => byId.has(p));
    if (!hasParent) continue;
    const anc = ancestorsOf(o.id_public);
    let primary;
    if ([...sundaeMirabel].some(t => anc.has(t))) primary = 0;
    else if (anc.has('CTC258')) primary = 1;
    else if (anc.has('CTC265')) primary = 2;
    else primary = 3;

    const prev = assignments[o.id_public] || [];
    const cleaned = prev.filter(l => !REMOVE.has(l) && l !== primary);
    assignments[o.id_public] = [primary, ...cleaned];
  }

  await users.updateOne({ _id: user._id }, { $set: { animalBreedingLines: assignments } });
  console.log('Updated', Object.keys(assignments).length, 'animals');
  await client.close();
}
main().catch(e => { console.error(e); process.exit(1); });
