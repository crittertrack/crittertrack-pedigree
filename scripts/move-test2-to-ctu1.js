const mongoose = require('mongoose');
require('dotenv').config();
const { Animal, PublicAnimal, User } = require('../database/models');

const DRY_RUN = false;

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);

  const ctu1 = await User.findOne({ id_public: 'CTU1' }).lean();
  console.log('CTU1 _id:', ctu1._id.toString());

  // Test 2 prefixes: PvK, MS, M&M (M&M already moved to CTU6, but check anyway)
  const animals = await Animal.find({
    prefix: { $in: ['PvK', 'MS', 'M&M'] },
    ownerId_public: 'CTU8'
  }).lean();

  console.log(`\nFound ${animals.length} Test 2 animals on CTU8:`);
  for (const a of animals) {
    console.log(`  ${a.id_public} ${a.prefix} ${a.name}`);
  }

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
