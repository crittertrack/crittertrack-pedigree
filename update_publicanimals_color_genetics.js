require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });
const { MongoClient } = require('mongodb');

async function main() {
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const db = client.db(process.env.MONGODB_DB_NAME || undefined);
  const pa = db.collection('publicanimals');

  await pa.updateOne({ id_public: 'CTC1051' }, { $set: { color: 'Cream', geneticCode: 'Ay/a ch/cch D/d S/s' } });
  await pa.updateOne({ id_public: 'CTC1103' }, { $set: { color: 'Sable', geneticCode: 'Ay/a S/s Go/go' } });
  console.log('Done');
  await client.close();
}
main().catch(e => { console.error(e); process.exit(1); });