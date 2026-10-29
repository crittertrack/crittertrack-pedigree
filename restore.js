const { MongoClient } = require('mongodb');
require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });
(async () => {
  const c = new MongoClient(process.env.MONGODB_URI);
  await c.connect();
  const db = c.db();
  await db.collection('publicprofiles').updateOne(
    { userId_backend: '6935d63a9a5a8b31e51a4821' },
    { $unset: { animalBreedingLines: '' } }
  );
  console.log('Restored public profile: animalBreedingLines removed');
  await c.close();
})();