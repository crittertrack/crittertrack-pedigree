const { MongoClient } = require('mongodb');
require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });
(async () => {
  const c = new MongoClient(process.env.MONGODB_URI);
  await c.connect();
  const db = c.db();
  const usersColl = db.collection('users');
  const publicProfiles = db.collection('publicprofiles');
  const animals = db.collection('animals');

  const user = await usersColl.findOne({ id_public: 'CTU2' });
  const prof = await publicProfiles.findOne({ userId_backend: user._id });

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
  const sundaeMirabel = new Set(['CTC46', 'CTC43']);
  const assignments = {};

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
    assignments[o.id_public] = [primary];
  }

  // keep existing lines for non-owned animals
  const existing = prof.animalBreedingLines || {};
  for (const [id, line] of Object.entries(existing)) {
    if (!byId.has(id) || byId.get(id).creatorId_public !== 'CTU2' || byId.get(id).isOwned !== true) {
      assignments[id] = line;
    }
  }

  await publicProfiles.updateOne({ _id: prof._id }, { $set: { animalBreedingLines: assignments } });
  console.log('Assigned lines to', Object.keys(assignments).length, 'animals');
  await c.close();
})();