require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { MongoClient } = require('mongodb');
const uri = process.env.MONGODB_URI;

async function main() {
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db();
  const coll = db.collection('animals');

  const ids = ['CTC7597','CTC5040','CTC4390','CTC2997','CTC4381','CTC3001','CTC4389','CTC2966'];
  const specified = await coll.find({ id_public: { $in: ids } }, {
    projection: { _id: 0, id_public: 1, name: 1, prefix: 1, suffix: 1, species: 1, archived: 1, creatorId: 1, breederAssignedId: 1 }
  }).toArray();
  console.log('SPECIFIED_MATCHES');
  console.log(JSON.stringify(specified, null, 2));

  const mmExcluded = await coll.find({
    species: 'Fancy Mouse',
    $or: [
      { prefix: { $not: /^MM\b/i } },
      { prefix: null },
      { prefix: '' }
    ]
  }, {
    projection: { _id: 0, id_public: 1, name: 1, prefix: 1, species: 1, archived: 1, creatorId: 1 }
  }).toArray();
  console.log('MM_EXCLUDED_COUNT', mmExcluded.length);

  const map = new Map();
  for (const a of mmExcluded) {
    const base = (a.name || '').trim();
    const key = ((a.prefix || '').trim() + ' ' + base).trim();
    if (!key) continue;
    const k = key.toLowerCase();
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(a);
  }

  const dupGroups = [...map.entries()].filter(([, arr]) => arr.length > 1).slice(0, 40);
  console.log('DUPLICATE_GROUP_COUNT', dupGroups.length);
  for (const [k, arr] of dupGroups) {
    console.log('GROUP', k, arr.map(a => `${a.id_public}:${a.archived ? 'archived' : 'active'}:${String(a.creatorId)}`).join(' | '));
  }

  await client.close();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
