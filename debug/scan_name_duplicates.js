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
        { prefix: /^MM\s+/i }
      ] }
    ]
  }, {
    projection: { _id: 0, id_public: 1, name: 1, prefix: 1, suffix: 1, species: 1, archived: 1, creatorId: 1 }
  }).toArray();

  const map = new Map();
  for (const a of docs) {
    const nm = `${(a.prefix || '').trim()} ${(a.name || '').trim()}`.replace(/\s+/g, ' ').trim();
    if (!nm) continue;
    const key = `${String(a.creatorId)}|${nm.toLowerCase()}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(a);
  }

  const groups = [...map.values()].filter(arr => arr.length > 1).sort((a, b) => b.length - a.length || a[0].id_public.localeCompare(b[0].id_public));
  console.log('TOTAL_GROUPS', groups.length);
  for (const arr of groups) {
    const nm = `${(arr[0].prefix || '').trim()} ${(arr[0].name || '').trim()}`.replace(/\s+/g, ' ').trim();
    console.log(nm, arr.map(a => `${a.id_public}:${a.archived ? 'archived' : 'active'}:${String(a.creatorId)}`).join(' | '));
  }

  await client.close();
})();
