const mongoose = require('mongoose');
require('dotenv').config();
const { Animal, PublicProfile } = require('../database/models');

const DRY_RUN = false;

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);

  // 1. Get CTU8 breeding line defs
  const profile = await PublicProfile.findOne({ id_public: 'CTU8' }).lean();
  console.log('Breeding line defs:');
  for (const d of profile.breedingLineDefs || []) {
    console.log(`  id=${d.id} name="${d.name}" color=${d.color}`);
  }

  // Find line IDs by name (case-insensitive match)
  const findLine = (name) => {
    const def = profile.breedingLineDefs.find(d => d.name.toLowerCase() === name.toLowerCase());
    if (!def) throw new Error(`Breeding line "${name}" not found`);
    return def.id;
  };

  const LINE_TEST2 = findLine('test 2');
  const LINE_TEST3 = findLine('test 3');
  const LINE_TEST4 = findLine('test 4');
  console.log(`\nLine IDs: "test 2"=${LINE_TEST2}, "test 3"=${LINE_TEST3}, "test 4"=${LINE_TEST4}`);

  // 2. Aggregate animals by prefix
  const prefixCounts = await Animal.aggregate([
    { $match: { ownerId_public: 'CTU8' } },
    { $group: { _id: '$prefix', count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]);

  // 3. Categorize prefixes
  const test2Prefixes = ['PvK', 'MS', 'M&M']; // explicitly named
  const test4Singles = []; // count == 1, plus null/empty prefix, plus Tns
  const test3Mid = [];     // count 2-6 (excluding test2 overrides)

  for (const { _id: prefix, count } of prefixCounts) {
    const p = prefix || null;
    // Check if it's one of the explicit Test 2 prefixes
    if (test2Prefixes.includes(p)) continue; // handled separately

    if (p === null || p === '' || count === 1) {
      test4Singles.push(p);
    } else if (count >= 2 && count <= 6) {
      test3Mid.push(p);
    }
    // count >= 7 and not in test2 list: not assigned
  }

  console.log(`\n"Test 4" prefixes (${test4Singles.length}): ${test4Singles.map(p => p || '(none)').join(', ')}`);
  console.log(`"Test 3" prefixes (${test3Mid.length}): ${test3Mid.join(', ')}`);
  console.log(`"Test 2" prefixes (${test2Prefixes.length}): ${test2Prefixes.join(', ')}`);

  // 4. Fetch all CTU8 animals that match any of these prefixes
  const allTargetPrefixes = [...test4Singles, ...test3Mid, ...test2Prefixes];
  
  // Build query for each group and count
  const test4Animals = await Animal.find({
    ownerId_public: 'CTU8',
    $or: [
      { prefix: { $in: test4Singles.filter(p => p !== null) } },
      ...(test4Singles.includes(null) ? [{ prefix: null }, { prefix: '' }, { prefix: { $exists: false } }] : [])
    ]
  }).select('id_public prefix name').lean();

  const test3Animals = await Animal.find({
    ownerId_public: 'CTU8',
    prefix: { $in: test3Mid }
  }).select('id_public prefix name').lean();

  const test2Animals = await Animal.find({
    ownerId_public: 'CTU8',
    prefix: { $in: test2Prefixes }
  }).select('id_public prefix name').lean();

  console.log(`\nAnimals to assign:`);
  console.log(`  "Test 4": ${test4Animals.length} animals`);
  console.log(`  "Test 3": ${test3Animals.length} animals`);
  console.log(`  "Test 2": ${test2Animals.length} animals`);

  if (DRY_RUN) {
    console.log('\n=== DRY RUN — no changes made ===');
    await mongoose.disconnect();
    return;
  }

  // 5. Build the updated animalBreedingLines map
  // Start with existing map, remove any assignments for targeted animals, then set new ones
  const existing = profile.animalBreedingLines || {};
  const updated = { ...existing };

  // All targeted animal id_publics
  const allTargeted = [...test4Animals, ...test3Animals, ...test2Animals].map(a => a.id_public);
  
  // Remove existing assignments for all targeted animals
  for (const id of allTargeted) {
    delete updated[id];
  }

  // Assign new lines
  for (const a of test4Animals) updated[a.id_public] = [LINE_TEST4];
  for (const a of test3Animals) updated[a.id_public] = [LINE_TEST3];
  for (const a of test2Animals) updated[a.id_public] = [LINE_TEST2];

  // 6. Save
  await PublicProfile.updateOne(
    { id_public: 'CTU8' },
    { $set: { animalBreedingLines: updated } }
  );

  console.log(`\nDone! Updated animalBreedingLines on CTU8 PublicProfile.`);
  console.log(`  ${test4Animals.length} animals → "test 4" (line ${LINE_TEST4})`);
  console.log(`  ${test3Animals.length} animals → "test 3" (line ${LINE_TEST3})`);
  console.log(`  ${test2Animals.length} animals → "test 2" (line ${LINE_TEST2})`);

  await mongoose.disconnect();
})();
