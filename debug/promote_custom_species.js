/**
 * Polish + promote custom species:
 *  1. Fix names missing a starting capital (species + animals + publicanimals)
 *  2. Verify categories are valid
 *  3. Set isDefault: true on all custom species
 *
 * Usage: node debug/promote_custom_species.js            # dry run
 *        node debug/promote_custom_species.js --apply
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { MongoClient } = require('mongodb');

const APPLY = process.argv.includes('--apply');
const VALID_CATEGORIES = ['Mammal', 'Reptile', 'Bird', 'Amphibian', 'Fish', 'Invertebrate', 'Other'];

// Names missing a starting capital -> fixed version
const CAPITAL_FIXES = {
  'kigoma baboon': 'Kigoma baboon',
  'pumpkin patch': 'Pumpkin patch',
  'red island birdeater': 'Red island birdeater',
};

(async () => {
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const db = client.db();

  const customs = await db.collection('species').find({ isDefault: false }).toArray();
  console.log(`=== CUSTOM SPECIES (${customs.length}) ===`);
  for (const s of customs) {
    const catOk = VALID_CATEGORIES.includes(s.category);
    const capOk = /^[A-Z0-9]/.test(s.name);
    console.log(`- "${s.name}" [${s.category}] ${catOk ? 'category OK' : 'INVALID CATEGORY'} | ${capOk ? 'capital OK' : 'NEEDS CAPITAL'}`);
  }

  // Capital-start audit across ALL species
  console.log('\n=== MISSING STARTING CAPITAL ===');
  const all = await db.collection('species').find({}).toArray();
  const bad = all.filter(s => !/^[A-Z0-9]/.test(s.name));
  bad.forEach(s => console.log(`- "${s.name}" -> "${CAPITAL_FIXES[s.name] || s.name[0].toUpperCase() + s.name.slice(1)}" (${s.isDefault ? 'default' : 'custom'})`));

  // What would change
  console.log('\n=== PLANNED CHANGES ===');
  const invalid = customs.filter(s => !VALID_CATEGORIES.includes(s.category));
  console.log(`- Promote to default: ${customs.length} species${invalid.length ? ` (BLOCKED: ${invalid.length} invalid category)` : ''}`);
  Object.entries(CAPITAL_FIXES).forEach(([from, to]) => console.log(`- Rename: "${from}" -> "${to}" (species + animals + publicanimals)`));

  if (!APPLY) { console.log('\nDRY RUN — re-run with --apply.'); await client.close(); return; }
  if (invalid.length) { console.error('ABORT: invalid categories present'); process.exit(1); }

  // 1. Capital fixes everywhere
  for (const [from, to] of Object.entries(CAPITAL_FIXES)) {
    const esc = from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const rx = { $regex: '^' + esc + '$', $options: 'i' };
    const s1 = await db.collection('species').updateOne({ name: rx }, { $set: { name: to } });
    const s2 = await db.collection('animals').updateMany({ species: rx }, { $set: { species: to } });
    const s3 = await db.collection('publicanimals').updateMany({ species: rx }, { $set: { species: to } });
    console.log(`Renamed "${from}" -> "${to}": species=${s1.modifiedCount} animals=${s2.modifiedCount} public=${s3.modifiedCount}`);
  }

  // 2. Promote all custom species to defaults
  const promo = await db.collection('species').updateMany({ isDefault: false }, { $set: { isDefault: true } });
  console.log(`Promoted to default: ${promo.modifiedCount}`);

  // Verify
  const remaining = await db.collection('species').countDocuments({ isDefault: false });
  const stillBad = (await db.collection('species').find({}).toArray()).filter(s => !/^[A-Z0-9]/.test(s.name));
  console.log(`\nVerify: custom species left=${remaining} | names missing capital=${stillBad.length} ${remaining === 0 && stillBad.length === 0 ? '(OK)' : '(FAILED)'}`);
  if (remaining !== 0 || stillBad.length !== 0) process.exit(1);

  await client.close();
})().catch(err => { console.error(err); process.exit(1); });
