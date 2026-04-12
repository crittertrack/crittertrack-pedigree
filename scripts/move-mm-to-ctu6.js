const mongoose = require('mongoose');
require('dotenv').config();
const { Animal, PublicAnimal, User } = require('../database/models');

const DRY_RUN = false;

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);

  const ctu6 = await User.findOne({ id_public: 'CTU6' }).lean();
  if (!ctu6) { console.log('CTU6 not found'); await mongoose.disconnect(); return; }
  console.log('CTU6 _id:', ctu6._id.toString());

  // Find all M&M animals on CTU8 and CTU1
  const animals = await Animal.find({
    prefix: 'M&M',
    ownerId_public: { $in: ['CTU8', 'CTU1'] }
  }).lean();

  console.log(`\nFound ${animals.length} M&M animals:`);
  const bySrc = {};
  for (const a of animals) {
    bySrc[a.ownerId_public] = (bySrc[a.ownerId_public] || 0) + 1;
    console.log(`  ${a.id_public} ${a.ownerId_public} ${a.name} (isOwned=${a.isOwned}, showOnPublicProfile=${a.showOnPublicProfile})`);
  }
  for (const [src, cnt] of Object.entries(bySrc)) console.log(`  ${src}: ${cnt}`);

  if (DRY_RUN) {
    console.log('\n=== DRY RUN — no changes made ===');
    await mongoose.disconnect();
    return;
  }

  const ids = animals.map(a => a._id);
  const idPublics = animals.map(a => a.id_public);

  // Move Animal docs: new owner, unowned, public
  await Animal.updateMany(
    { _id: { $in: ids } },
    { $set: { ownerId: ctu6._id, ownerId_public: 'CTU6', isOwned: false, showOnPublicProfile: true } }
  );

  // Move PublicAnimal docs: new owner, unowned, public
  await PublicAnimal.updateMany(
    { id_public: { $in: idPublics } },
    { $set: { ownerId_public: 'CTU6', isOwned: false, showOnPublicProfile: true } }
  );

  console.log(`Moved ${ids.length} animals to CTU6 (unowned, public)`);

  // Rebuild ownedAnimals for affected users
  for (const uid of ['CTU8', 'CTU1', 'CTU6']) {
    const user = await User.findOne({ id_public: uid });
    const owned = await Animal.find({ ownerId: user._id }).select('_id').lean();
    user.ownedAnimals = owned.map(a => a._id);
    await user.save();
    console.log(`${uid}: ownedAnimals = ${user.ownedAnimals.length}`);
  }

  console.log('\nDone!');
  await mongoose.disconnect();
})();
