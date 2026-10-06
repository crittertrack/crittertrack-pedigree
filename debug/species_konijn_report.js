require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { MongoClient } = require('mongodb');

(async () => {
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const db = client.db();

  const speciesColl = db.collection('species');
  const animalsColl = db.collection('animals');
  const usersColl = db.collection('users');

  // --- 1. Full species list ---
  const allSpecies = await speciesColl
    .find({}, { projection: { _id: 0, name: 1, latinName: 1, category: 1, isDefault: 1, createdBy_public: 1, userId: 1, createdAt: 1 } })
    .sort({ isDefault: -1, name: 1 })
    .toArray();

  const defaults = allSpecies.filter(s => s.isDefault);
  const customs = allSpecies.filter(s => !s.isDefault);

  console.log(`=== SPECIES LIST ===`);
  console.log(`TOTAL: ${allSpecies.length}  (default: ${defaults.length}, custom: ${customs.length})`);
  console.log(`\n--- Default species (${defaults.length}) ---`);
  console.log(defaults.map(s => `${s.name} [${s.category}]`).join(', '));

  // --- 2. Custom species + who added them ---
  console.log(`\n=== CUSTOM SPECIES (${customs.length}) ===`);
  const userIds = customs.map(s => s.userId).filter(Boolean);
  const publicIds = customs.map(s => s.createdBy_public).filter(Boolean);
  const users = await usersColl.find({
    $or: [{ _id: { $in: userIds } }, { id_public: { $in: publicIds } }]
  }, { projection: { _id: 1, id_public: 1, personalName: 1, email: 1 } }).toArray();

  const findUser = (s) => users.find(u =>
    (s.userId && String(u._id) === String(s.userId)) ||
    (s.createdBy_public && u.id_public === s.createdBy_public)
  );

  for (const s of customs) {
    const u = findUser(s);
    const who = u ? `${u.personalName} (${u.email}, ${u.id_public})` : (s.createdBy_public || (s.userId ? `userId:${s.userId}` : 'unknown'));
    const created = s.createdAt ? new Date(s.createdAt).toISOString().slice(0, 10) : '?';
    console.log(`- "${s.name}" [${s.category}]${s.latinName ? ` (${s.latinName})` : ''} | added by: ${who} | ${created}`);
  }

  // --- 3. "konijn" usage ---
  console.log(`\n=== "konijn" USAGE ===`);

  // 3a. In the species collection itself
  const konijnSpecies = await speciesColl.find({ name: { $regex: 'konijn', $options: 'i' } }).toArray();
  console.log(`Species entries matching "konijn": ${konijnSpecies.length}`);
  for (const s of konijnSpecies) console.log(`- "${s.name}" isDefault=${s.isDefault} createdBy_public=${s.createdBy_public || 'n/a'}`);

  // 3b. In animals (species field), grouped by creator
  const konijnAnimals = await animalsColl.aggregate([
    { $match: { species: { $regex: 'konijn', $options: 'i' } } },
    { $group: { _id: { creatorId: '$creatorId', species: '$species' }, count: { $sum: 1 }, ids: { $push: { id_public: '$id_public', name: '$name', prefix: '$prefix' } } } },
    { $sort: { count: -1 } }
  ]).toArray();

  const totalAnimalUsages = konijnAnimals.reduce((n, g) => n + g.count, 0);
  console.log(`\nAnimals with species matching "konijn": ${totalAnimalUsages}`);

  // Keep creatorIds as ObjectIds (do NOT stringify) so the $in lookup matches
  const creatorIds = [...new Set(konijnAnimals.map(g => g._id.creatorId).filter(Boolean))];
  const creatorUsers = await usersColl.find({ _id: { $in: creatorIds } },
    { projection: { _id: 1, id_public: 1, personalName: 1, email: 1 } }).toArray();
  const creatorName = (id) => {
    const u = creatorUsers.find(x => String(x._id) === String(id));
    return u ? `${u.personalName} (${u.email}, ${u.id_public})` : `userId:${id}`;
  };

  const perUser = new Map();
  for (const g of konijnAnimals) {
    const key = String(g._id.creatorId);
    if (!perUser.has(key)) perUser.set(key, { count: 0, creatorId: g._id.creatorId, variants: [], animals: [] });
    perUser.get(key).count += g.count;
    perUser.get(key).variants.push(`${g._id.species} ×${g.count}`);
    perUser.get(key).animals.push(...g.ids.map(a => `${a.id_public} "${((a.prefix || '') + ' ' + (a.name || '')).trim()}"`));
  }
  console.log(`\nBy user:`);
  for (const u of [...perUser.values()].sort((a, b) => b.count - a.count)) {
    console.log(`- ${creatorName(u.creatorId)}: ${u.count} animal(s) [${u.variants.join(', ')}] -> ${u.animals.join(', ')}`);
  }

  // 3c. In user favorites
  const favUsers = await usersColl.find({ speciesFavorites: { $regex: 'konijn', $options: 'i' } },
    { projection: { id_public: 1, personalName: 1, email: 1 } }).toArray();
  console.log(`\nUsers with "konijn" in speciesFavorites: ${favUsers.length}`);
  for (const u of favUsers) console.log(`- ${u.personalName} (${u.email}, ${u.id_public})`);

  await client.close();
})().catch(err => { console.error(err); process.exit(1); });
