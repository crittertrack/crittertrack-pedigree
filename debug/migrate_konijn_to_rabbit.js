require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { MongoClient } = require('mongodb');

(async () => {
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const db = client.db();

  const speciesColl = db.collection('species');
  const animalsColl = db.collection('animals');

  // Safety checks: target default species exists, source custom species exists
  const target = await speciesColl.findOne({ name: /^Rabbit$/i });
  if (!target) { console.error('ABORT: default species "Rabbit" not found'); process.exit(1); }
  if (!target.isDefault) { console.error('ABORT: "Rabbit" is not a default species'); process.exit(1); }
  const source = await speciesColl.findOne({ name: /^Konijn$/i });
  if (!source) console.log('NOTE: species "Konijn" not found (already removed?) — animals update will still run');

  const toUpdate = await animalsColl.find({ species: { $regex: '^konijn$', $options: 'i' } },
    { projection: { _id: 1, id_public: 1, name: 1, prefix: 1, species: 1, archived: 1 } }).toArray();
  console.log(`Animals with species "Konijn": ${toUpdate.length}`);
  for (const a of toUpdate) console.log(`- ${a.id_public} "${((a.prefix || '') + ' ' + (a.name || '')).trim()}" (archived: ${!!a.archived})`);

  if (toUpdate.length === 0) { await client.close(); return; }

  const result = await animalsColl.updateMany(
    { species: { $regex: '^konijn$', $options: 'i' } },
    { $set: { species: 'Rabbit' } }
  );
  console.log(`\nUpdated ${result.modifiedCount} animal(s): "Konijn" -> "Rabbit"`);

  // Verify
  const remaining = await animalsColl.countDocuments({ species: { $regex: 'konijn', $options: 'i' } });
  const nowRabbit = await animalsColl.find({ _id: { $in: toUpdate.map(a => a._id) } },
    { projection: { _id: 0, id_public: 1, name: 1, species: 1 } }).toArray();
  console.log(`Remaining animals with "konijn": ${remaining}`);
  console.log('After update:');
  for (const a of nowRabbit) console.log(`- ${a.id_public}: species = "${a.species}"`);

  // Note: the custom "Konijn" species entry is intentionally left in place.
  console.log('\nCustom species entry "Konijn" left untouched (remove via admin/speciesRoutes if desired).');
  console.log('IMPORTANT: this raw update does NOT touch the publicanimals mirror.');
  console.log('Run "node debug/resync_konijn_rabbit_public.js" afterwards to resync the public copies.');

  await client.close();
})().catch(err => { console.error(err); process.exit(1); });
