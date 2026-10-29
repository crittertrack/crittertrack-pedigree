const { MongoClient } = require('mongodb');
require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });
(async () => {
  const c = new MongoClient(process.env.MONGODB_URI);
  await c.connect();
  const db = c.db();
  const usersColl = db.collection('users');
  const publicProfiles = db.collection('publicprofiles');
  const user = await usersColl.findOne({ id_public: 'CTU2' });
  const prof = await publicProfiles.findOne({ userId_backend: user._id });
  console.log('has lines:', !!prof && !!prof.animalBreedingLines);
  const a = prof.animalBreedingLines || {};
  const checkIds = ['CTC46', 'CTC43', 'CTC258', 'CTC265', 'CTC2618'];
  for (const id of checkIds) {
    console.log(id, a[id]);
  }
  console.log('total keys:', Object.keys(a).length);
  await c.close();
})();
