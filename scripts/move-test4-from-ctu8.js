const mongoose = require('mongoose');
require('dotenv').config();
const { Animal, PublicAnimal, User } = require('../database/models');

const DRY_RUN = false;

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);

  // 1. Look up destination users
  const ctu11 = await User.findOne({ id_public: 'CTU11' }).lean();
  const ctu4  = await User.findOne({ id_public: 'CTU4' }).lean();
  const ctu1  = await User.findOne({ id_public: 'CTU1' }).lean();

  if (!ctu11 || !ctu4 || !ctu1) {
    console.log('Missing user:', { ctu11: !!ctu11, ctu4: !!ctu4, ctu1: !!ctu1 });
    await mongoose.disconnect();
    return;
  }
  console.log('CTU11:', ctu11._id.toString());
  console.log('CTU4:', ctu4._id.toString());
  console.log('CTU1:', ctu1._id.toString());

  // 2. Get the "Test 4" animals on CTU8 (single-animal prefixes + no prefix + Tns)
  // These are the 22 animals we assigned to breeding line "test 4"
  const test4Prefixes = [
    null, '', 'MOW', 'MW', 'DE', 'LR', 'RM', 'MafiaSpade', 'Tns',
    'SA', 'DM', 'ASDY', 'CN', 'FKM', 'OP', 'FromMouseHouse',
    'Jedwab', 'RR', 'SDV', 'LVM', 'LD', 'HvR'
  ];

  const animals = await Animal.find({
    ownerId_public: 'CTU8',
    $or: [
      { prefix: { $in: test4Prefixes.filter(p => p !== null && p !== '') } },
      { prefix: null },
      { prefix: '' },
      { prefix: { $exists: false } }
    ]
  }).lean();

  console.log(`\nFound ${animals.length} Test 4 animals on CTU8`);

  // 3. Categorize
  const toMove = { CTU11: [], CTU4: [], CTU1: [] };
  const destMap = { CTU11: ctu11, CTU4: ctu4, CTU1: ctu1 };

  for (const a of animals) {
    const p = a.prefix || '';
    if (p === 'Tns') {
      toMove.CTU11.push(a);
    } else if (p === 'MafiaSpade') {
      toMove.CTU4.push(a);
    } else {
      toMove.CTU1.push(a);
    }
  }

  for (const [dest, list] of Object.entries(toMove)) {
    console.log(`\n→ ${dest} (${list.length}):`);
    for (const a of list) {
      console.log(`  ${a.id_public} ${a.prefix || '(none)'} ${a.name}`);
    }
  }

  if (DRY_RUN) {
    console.log('\n=== DRY RUN — no changes made ===');
    await mongoose.disconnect();
    return;
  }

  // 4. Move animals
  for (const [destPublic, list] of Object.entries(toMove)) {
    const destUser = destMap[destPublic];
    const ids = list.map(a => a._id);
    const idPublics = list.map(a => a.id_public);

    if (ids.length === 0) continue;

    // Update Animal docs
    await Animal.updateMany(
      { _id: { $in: ids } },
      { $set: { ownerId: destUser._id, ownerId_public: destPublic, isOwned: true } }
    );

    // Update PublicAnimal docs
    await PublicAnimal.updateMany(
      { id_public: { $in: idPublics } },
      { $set: { ownerId_public: destPublic, isOwned: true } }
    );

    console.log(`\nMoved ${ids.length} animals to ${destPublic}`);
  }

  // 5. Rebuild ownedAnimals for all affected users
  for (const uid of ['CTU8', 'CTU11', 'CTU4', 'CTU1']) {
    const user = await User.findOne({ id_public: uid });
    const owned = await Animal.find({ ownerId: user._id }).select('_id').lean();
    user.ownedAnimals = owned.map(a => a._id);
    await user.save();
    console.log(`${uid}: ownedAnimals = ${user.ownedAnimals.length}`);
  }

  console.log('\nDone!');
  await mongoose.disconnect();
})();
