const { MongoClient } = require('mongodb');
require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });

(async () => {
  const c = new MongoClient(process.env.MONGODB_URI);
  await c.connect();
  const db = c.db();
  const user = await db.collection('users').findOne({ id_public: 'CTU2' });
  const allAnimals = await db.collection('animals').find({}).toArray();
  const byId = new Map(allAnimals.map(a => [a.id_public, a]));
  const owned = new Set(allAnimals.filter(a => a.creatorId_public === 'CTU2').map(a => a.id_public));

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

  const root = 'CTC6917';
  const targets = descendants(root);
  // include root if owned
  if (owned.has(root)) targets.add(root);

  const cur = (user.animalBreedingLines && typeof user.animalBreedingLines === 'object') ? { ...user.animalBreedingLines } : {};
  let count = 0;
  for (const id of targets) {
    if (!owned.has(id)) continue;
    if (!Array.isArray(cur[id])) cur[id] = [];
    if (!cur[id].includes(3)) cur[id].push(3);
    count++;
  }
  await db.collection('users').updateOne({ _id: user._id }, { $set: { animalBreedingLines: cur } });
  console.log('assigned line 3 to', count, 'owned descendants of', root);
  await c.close();
})();
