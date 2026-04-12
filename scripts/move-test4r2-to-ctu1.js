const mongoose = require('mongoose');
require('dotenv').config();
const { Animal, PublicAnimal, User } = require('../database/models');

const DRY_RUN = false;
const TEST4_PREFIXES = ['CS', 'M3', 'ZC', 'PvK'];

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);

  const ctu1 = await User.findOne({ id_public: 'CTU1' }).lean();

  const animals = await Animal.find({
    prefix: { $in: TEST4_PREFIXES },
    ownerId_public: 'CTU8'
  }).lean();

  console.log(`Found ${animals.length} Test 4 animals on CTU8:`);
  const byPrefix = {};
  for (const a of animals) { byPrefix[a.prefix] = (byPrefix[a.prefix] || 0) + 1; }
  for (const [p, c] of Object.entries(byPrefix).sort((a,b) => b[1]-a[1])) console.log(`  ${p}: ${c}`);

  if (DRY_RUN) {
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
