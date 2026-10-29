const { MongoClient } = require('mongodb');
require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });

(async () => {
  const c = new MongoClient(process.env.MONGODB_URI);
  await c.connect();
  const db = c.db();
  const user = await db.collection('users').findOne({ id_public: 'CTU2' });
  if (!user) { console.error('CTU2 not found'); process.exit(1); }

  const allAnimals = await db.collection('animals').find({}).toArray();
  const byId = new Map(allAnimals.map(a => [a.id_public, a]));
  const owned = allAnimals.filter(a => a.creatorId_public === 'CTU2');

  const children = new Map();
  for (const a of allAnimals) {
    for (const pid of [a.sireId_public, a.damId_public]) {
      if (pid && byId.has(pid)) {
        if (!children.has(pid)) children.set(pid, []);
        children.get(pid).push(a.id_public);
      }
    }
  }
  const descendants = (rootId) => {
    const out = new Set();
    const stack = [rootId];
    while (stack.length) {
      const cur = stack.pop();
      for (const ch of (children.get(cur) || [])) {
        if (!out.has(ch)) { out.add(ch); stack.push(ch); }
      }
    }
    return out;
  };

  const sundaeId = 'CTC46';
  const mirabelId = 'CTC43';
  const bacoId = 'CTC258';
  const ambrosiaId = 'CTC265';

  const line0 = new Set([sundaeId, mirabelId]);
  descendants(sundaeId).forEach(x => line0.add(x));
  descendants(mirabelId).forEach(x => line0.add(x));

  const line1 = new Set([bacoId]);
  descendants(bacoId).forEach(x => line1.add(x));

  const line2 = new Set([ambrosiaId]);
  descendants(ambrosiaId).forEach(x => line2.add(x));

  const cur = (user.animalBreedingLines && typeof user.animalBreedingLines === 'object') ? { ...user.animalBreedingLines } : {};

  const remove = new Set([10, 11, 12]);
  for (const a of owned) {
    const id = a.id_public;
    let lines = Array.isArray(cur[id]) ? [...cur[id]] : [];
    lines = lines.filter(l => !remove.has(l));
    if (line0.has(id)) { if (!lines.includes(0)) lines.push(0); }
    if (line1.has(id)) { if (!lines.includes(1)) lines.push(1); }
    if (line2.has(id)) { if (!lines.includes(2)) lines.push(2); }
    if (!lines.includes(0) && !lines.includes(1) && !lines.includes(2)) {
      if (!lines.includes(3)) lines.push(3);
    }
    cur[id] = lines;
  }

  await db.collection('users').updateOne({ _id: user._id }, { $set: { animalBreedingLines: cur } });
  console.log('done. owned animals processed:', owned.length);
  const counts = {};
  for (const id of Object.keys(cur)) for (const l of cur[id]) counts[l] = (counts[l]||0)+1;
  console.log('line counts:', counts);
  await c.close();
})();
