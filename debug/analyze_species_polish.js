/**
 * Species polish analysis:
 *  1. Each remaining custom species: animal usage, overlap with defaults, latin name check
 *  2. Capitalization audit for ALL species (common name + latin name)
 *
 * Usage: node debug/analyze_species_polish.js
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { MongoClient } = require('mongodb');

// Latin binomial: Genus species( subspecies? ) — Genus capitalized, rest lowercase
// (also handles "Oryctolagus cuniculus domesticus")
const LATIN_OK = /^[A-Z][a-z]+(?:\s[a-z][a-z.-]+)+$/;
const COMMON_CAP_OK = /^[A-Z0-9]/; // first char uppercase or digit

(async () => {
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const db = client.db();

  const species = await db.collection('species').find({}).sort({ isDefault: -1, name: 1 }).toArray();

  // Animal usage counts per species (case-insensitive exact)
  const usage = await db.collection('animals').aggregate([
    { $group: { _id: { $toLower: '$species' }, count: { $sum: 1 }, exact: { $first: '$species' } } }
  ]).toArray();
  const usageMap = new Map(usage.map(u => [u._id, u.count]));

  const countFor = (name) => usageMap.get(name.toLowerCase()) || 0;

  // ---- 1. Custom species analysis ----
  const customs = species.filter(s => !s.isDefault);
  console.log(`=== CUSTOM SPECIES ANALYSIS (${customs.length}) ===`);
  for (const s of customs) {
    const animals = countFor(s.name);
    // Overlap candidates among defaults (fuzzy: shared first word or known synonyms)
    const overlaps = species.filter(d =>
      d.isDefault &&
      d.name.toLowerCase() !== s.name.toLowerCase() &&
      (d.name.toLowerCase().split(' ')[0] === s.name.toLowerCase().split(' ')[0] ||
       (s.latinName && d.latinName && s.latinName.toLowerCase().startsWith(d.latinName.toLowerCase().split(' ').slice(0, 2).join(' '))))
    ).map(d => `${d.name}${d.latinName ? ` (${d.latinName})` : ''} [${countFor(d.name)} animals]`);

    console.log(`\n"${s.name}" [${s.category}] ${s.latinName ? `(${s.latinName})` : 'NO LATIN NAME'}`);
    console.log(`  added by ${s.createdBy_public || 'unknown'} on ${new Date(s.createdAt).toISOString().slice(0, 10)}`);
    console.log(`  animal usage: ${animals}`);
    console.log(`  latin name check: ${!s.latinName ? 'MISSING' : LATIN_OK.test(s.latinName) ? 'OK' : `SUSPECT — "${s.latinName}"`}`);
    console.log(`  possible default overlap: ${overlaps.length ? overlaps.join('; ') : 'none'}`);
    console.log(`  name capitalization: ${COMMON_CAP_OK.test(s.name) ? 'OK' : `MISSING CAPITAL — "${s.name}"`}`);
  }

  // ---- 2. Capitalization audit (all species) ----
  console.log(`\n=== CAPITALIZATION AUDIT (${species.length} species) ===`);

  const badCommon = species.filter(s => !COMMON_CAP_OK.test(s.name));
  console.log(`\nCommon names missing starting capital: ${badCommon.length}`);
  badCommon.forEach(s => console.log(`- "${s.name}" (${s.isDefault ? 'default' : 'custom'}, ${s.category}, ${countFor(s.name)} animals)`));

  const withLatin = species.filter(s => s.latinName && s.latinName.trim());
  const badLatin = withLatin.filter(s => !LATIN_OK.test(s.latinName));
  console.log(`\nSpecies with latin names: ${withLatin.length}; suspect formatting: ${badLatin.length}`);
  badLatin.forEach(s => console.log(`- "${s.name}": "${s.latinName}" (${s.isDefault ? 'default' : 'custom'})`));

  const noLatin = species.filter(s => !s.latinName || !s.latinName.trim());
  console.log(`\nSpecies without latin name: ${noLatin.length}`);
  noLatin.forEach(s => console.log(`- "${s.name}" (${s.isDefault ? 'default' : 'custom'}, ${countFor(s.name)} animals)`));

  await client.close();
})().catch(err => { console.error(err); process.exit(1); });
