const mongoose = require('mongoose');
require('dotenv').config();
const { Animal, PublicAnimal, PublicProfile } = require('../database/models');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);

  // Get CTU8 profile and test 4 assignments
  const profile = await PublicProfile.findOne({ id_public: 'CTU8' });
  const abl = profile.animalBreedingLines || {};
  const test4Ids = new Set(Object.entries(abl).filter(([, lines]) => lines.includes(3)).map(([id]) => id));

  // Find TnS prefix animals on CTU8 that are in test 4
  const tnsAnimals = await Animal.find({ ownerId_public: 'CTU8', prefix: 'TnS' }).select('id_public name').lean();
  const toMove = tnsAnimals.filter(a => test4Ids.has(a.id_public));

  console.log(`TnS animals on CTU8: ${tnsAnimals.length}`);
  console.log(`TnS in test 4 (to move): ${toMove.length}`);

  const moveIds = toMove.map(a => a.id_public);

  // Move to CTU11
  const aResult = await Animal.updateMany(
    { id_public: { $in: moveIds } },
    { $set: { ownerId_public: 'CTU11' } }
  );
  console.log(`Animal: ${aResult.modifiedCount} moved to CTU11`);

  const pResult = await PublicAnimal.updateMany(
    { id_public: { $in: moveIds } },
    { $set: { ownerId_public: 'CTU11' } }
  );
  console.log(`PublicAnimal: ${pResult.modifiedCount} moved to CTU11`);

  // Remove from CTU8 breeding lines
  for (const id of moveIds) {
    delete abl[id];
  }
  await PublicProfile.updateOne(
    { id_public: 'CTU8' },
    { $set: { animalBreedingLines: abl } }
  );
  console.log(`Removed ${moveIds.length} entries from CTU8 breeding lines`);

  console.log('\nDone!');
  await mongoose.disconnect();
})();
