const { MongoClient } = require('mongodb');
require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });
(async () => {
  const c = new MongoClient(process.env.MONGODB_URI);
  await c.connect();
  const db = c.db();
  const as = await db.collection('animals').find({ creatorId_public: 'CTU2', name: { $regex: /mirabel|baco/i } }).toArray();
  console.log(JSON.stringify(as.map(a=>({id:a.id_public,name:a.name})),null,2));
  await c.close();
})();
