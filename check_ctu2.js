const { MongoClient } = require('mongodb');
require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });
(async () => {
  const c = new MongoClient(process.env.MONGODB_URI);
  await c.connect();
  const db = c.db();
  const u = await db.collection('users').findOne({ id_public: 'CTU2' }, { projection: { animalBreedingLines: 1 } });
  console.log('sample:', JSON.stringify(Object.entries(u.animalBreedingLines).slice(0, 5)));
  console.log('total:', Object.keys(u.animalBreedingLines).length);
  await c.close();
})();
