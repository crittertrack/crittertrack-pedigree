require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });
const { MongoClient } = require('mongodb');

async function main() {
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const db = client.db(process.env.MONGODB_DB_NAME || undefined);
  await db.collection('animals').updateOne({ id_public: 'CTC6917' }, { $set: { marking: '' } });
  await db.collection('publicanimals').updateOne({ id_public: 'CTC6917' }, { $set: { marking: '' } });
  console.log('Done');
  await client.close();
}
main().catch(e => { console.error(e); process.exit(1); });