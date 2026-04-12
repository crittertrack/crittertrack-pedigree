const mongoose = require('mongoose');
require('dotenv').config();
const { Animal, PublicAnimal, User } = require('../database/models');

const DRY_RUN = false;

// Test 3 prefixes (2-6 animals each, from earlier assignment)
const TEST3_PREFIXES = [
  'MB', 'MV', 'MZM', 'MJ', 'MoW', 'PLX', 'PVK', 'DA', 'TRM', 'FF',
  'Phantom', 'AM', 'LK', 'SR', 'G', 'MF', 'Halmaus', 'VW', 'MAM', 'KHE',
  'FS', 'SZ', 'MLP', 'N', 'KW', 'KP', "LK's", 'NLB'
];

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);

  const ctu1 = await User.findOne({ id_public: 'CTU1' }).lean();
  console.log('CTU1 _id:', ctu1._id.toString());

  const animals = await Animal.find({
    prefix: { $in: TEST3_PREFIXES },
    ownerId_public: 'CTU8'
  }).lean();

  console.log(`\nFound ${animals.length} Test 3 animals on CTU8`);

  if (DRY_RUN) {
    const byPrefix = {};
    for (const a of animals) { byPrefix[a.prefix] = (byPrefix[a.prefix] || 0) + 1; }
    for (const [p, c] of Object.entries(byPrefix).sort((a,b) => b[1]-a[1])) console.log(`  ${p}: ${c}`);
    console.log('\n=== DRY RUN — no changes made ===');
    await mongoose.disconnect();
    return;
  }

  const ids = animals.map(a => a._id);
  const idPublics = animals.map(a => a.id_public);

  await Animal.updateMany(
    { _id: { $in: ids } },
    { $set: { ownerId: ctu1._id, ownerId_public: 'CTU1', isOwned: true } }
  );

  await PublicAnimal.updateMany(
    { id_public: { $in: idPublics } },
    { $set: { ownerId_public: 'CTU1', isOwned: true } }
  );

  console.log(`Moved ${ids.length} animals to CTU1`);

  for (const uid of ['CTU8', 'CTU1']) {
    const user = await User.findOne({ id_public: uid });
    const owned = await Animal.find({ ownerId: user._id }).select('_id').lean();
    user.ownedAnimals = owned.map(a => a._id);
    await user.save();
    console.log(`${uid}: ownedAnimals = ${user.ownedAnimals.length}`);
  }

  console.log('\nDone!');
  await mongoose.disconnect();
})();
