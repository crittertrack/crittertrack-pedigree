require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });
const { MongoClient } = require('mongodb');

async function main() {
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const db = client.db(process.env.MONGODB_DB_NAME || undefined);
  for (const id of ['CTC1058', 'CTC1059']) {
    for (const coll of ['animals', 'publicanimals']) {
      await db.collection(coll).updateOne({ id_public: id }, { $set: { color: 'Dominant Red', geneticCode: 'Ay/a S/s go/go' } });
    }
  }
  console.log('Done');
  await client.close();
}
main().catch(e => { console.error(e); process.exit(1); });