/**
 * Re-sync the publicanimals mirror for the animals migrated off the custom
 * "Konijn" species onto default "Rabbit" (CTC8027/CTC8028/CTC8029).
 *
 * Uses the codebase's own resyncAnimalToPublicById() so every mirrored field
 * (not just species) is refreshed exactly the way a normal edit would.
 *
 * Usage:
 *   node debug/resync_konijn_rabbit_public.js
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const { resyncAnimalToPublicById } = require('../utils/syncPublicAnimals');

const TARGETS = ['CTC8027', 'CTC8028', 'CTC8029'];

(async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) { console.error('MONGODB_URI is not set. Check your .env.'); process.exit(1); }

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 });
  const { Animal, PublicAnimal } = require('../database/models');

  // Sanity check: source animals should already be "Rabbit"
  for (const id of TARGETS) {
    const a = await Animal.findOne({ id_public: id }, { id_public: 1, name: 1, species: 1, isDisplay: 1 }).lean();
    if (!a) { console.error(`ABORT: animal ${id} not found in animals collection`); process.exit(1); }
    if (a.species !== 'Rabbit') { console.error(`ABORT: animal ${id} species is "${a.species}", expected "Rabbit"`); process.exit(1); }
    const pub = await PublicAnimal.findOne({ id_public: id }, { id_public: 1, species: 1 }).lean();
    console.log(`- ${id} "${a.name}": private species="${a.species}" isDisplay=${!!a.isDisplay} | public mirror: ${pub ? `species="${pub.species}"` : 'not present'}`);
  }

  // Resync each via the canonical code path
  for (const id of TARGETS) {
    await resyncAnimalToPublicById(id);
    console.log(`Resynced ${id} -> publicanimals`);
  }

  // Verify
  console.log('\nVerification:');
  let ok = true;
  for (const id of TARGETS) {
    const a = await Animal.findOne({ id_public: id }, { species: 1, isDisplay: 1 }).lean();
    const pub = await PublicAnimal.findOne({ id_public: id }, { species: 1 }).lean();
    const expected = a.isDisplay ? 'Rabbit' : null; // non-display animals are removed from mirror
    const actual = pub ? pub.species : null;
    const match = actual === expected;
    if (!match) ok = false;
    console.log(`- ${id}: private="${a.species}" | public=${pub ? `"${actual}"` : 'absent'} | ${match ? 'OK' : 'MISMATCH'}`);
  }

  const remaining = await PublicAnimal.countDocuments({ species: /konijn/i });
  console.log(`\npublicanimals still matching "konijn": ${remaining}`);
  if (!ok || remaining > 0) { console.error('FAILED verification'); process.exit(1); }
  console.log('All good.');

  await mongoose.disconnect();
})().catch(err => { console.error(err); process.exit(1); });

