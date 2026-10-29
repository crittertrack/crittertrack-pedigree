const { MongoClient } = require('mongodb');
require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });
(async () => {
  const c = new MongoClient(process.env.MONGODB_URI);
  await c.connect();
  const db = c.db();
  const users = await db.collection('users').find({ breedingLineDefs: { $exists: true, $ne: [] } }).toArray();
  console.log('users with lines:', users.length);
  for (const u of users) console.log(u.id_public, u.email, JSON.stringify(u.breedingLineDefs));
  await c.close();
})();
