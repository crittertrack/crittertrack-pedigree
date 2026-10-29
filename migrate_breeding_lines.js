const { MongoClient } = require('mongodb');
require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });

(async () => {
  const c = new MongoClient(process.env.MONGODB_URI);
  await c.connect();
  const db = c.db();
  const profiles = await db.collection('publicprofiles').find({
    $or: [
      { breedingLineDefs: { $exists: true, $ne: [] } },
      { animalBreedingLines: { $exists: true, $ne: {} } }
    ]
  }).toArray();
  console.log('profiles with breeding lines:', profiles.length);

  let migrated = 0;
  for (const p of profiles) {
    const user = await db.collection('users').findOne({ _id: p.userId_backend });
    if (!user) { console.log('no user for profile', p.id_public); continue; }
    const hasDefs = Array.isArray(user.breedingLineDefs) && user.breedingLineDefs.length > 0;
    const hasAssign = user.animalBreedingLines && Object.keys(user.animalBreedingLines).length > 0;
    if (hasDefs && hasAssign) { console.log('skip (already has data):', p.id_public); continue; }
    const set = {};
    if (!hasDefs && Array.isArray(p.breedingLineDefs) && p.breedingLineDefs.length) set.breedingLineDefs = p.breedingLineDefs;
    if (!hasAssign && p.animalBreedingLines && Object.keys(p.animalBreedingLines).length) set.animalBreedingLines = p.animalBreedingLines;
    if (Object.keys(set).length === 0) { console.log('nothing to migrate:', p.id_public); continue; }
    await db.collection('users').updateOne({ _id: p.userId_backend }, { $set: set });
    migrated++;
    console.log('migrated:', p.id_public, Object.keys(set));
  }
  console.log('total migrated:', migrated);
  await c.close();
})();
