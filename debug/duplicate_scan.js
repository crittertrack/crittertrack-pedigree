require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { MongoClient } = require('mongodb');

(async () => {
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const coll = client.db().collection('animals');

  const docs = await coll.find({
    species: 'Fancy Mouse',
    $and: [
      { $nor: [
        { name: /^MM\b/i },
        { prefix: /^MM\b/i },
        { name: /^MM\s+/i },
        { prefix: /^MM\s+/i },
      ] }
    ]
  }, {
    projection: { _id: 0, id_public: 1, name: 1, prefix: 1, suffix: 1, species: 1, archived: 1, creatorId: 1 }
  }).toArray();

  const byOwnerAndName = new Map();
  for (const a of docs) {
    const fullName = `${(a.prefix || '').trim()} ${(a.name || '').trim()} ${(a.suffix || '').trim()}`.replace(/\s+/g, ' ').trim();
    const key = `${String(a.creatorId)}|${fullName.toLowerCase()}`;
    if (!fullName) continue;
    if (!byOwnerAndName.has(key)) byOwnerAndName.set(key, []);
    byOwnerAndName.get(key).push(a);
  }

  const groups = [...byOwnerAndName.values()]
    .filter(arr => arr.length > 1)
    .sort((a, b) => b.length - a.length || a[0].id_public.localeCompare(b[0].id_public));

  console.log('SAME_OWNER_DUP_GROUPS', groups.length);
  for (const arr of groups.slice(0, 100)) {
    const fullName = `${(arr[0].prefix || '').trim()} ${(arr[0].name || '').trim()} ${(arr[0].suffix || '').trim()}`.replace(/\s+/g, ' ').trim();
    console.log(fullName, arr.map(a => `${a.id_public}:${a.archived ? 'archived' : 'active'}:${String(a.creatorId)}`).join(' | '));
  }

  const requested = ['CTC7597','CTC5040','CTC4390','CTC2997','CTC4381','CTC3001','CTC4389','CTC2966'];
  console.log('REQUESTED_CHECK', requested.map(id => docs.find(a => a.id_public === id) ? 'found' : 'missing').join(' '));

  await client.close();
})();
