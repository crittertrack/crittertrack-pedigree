const mongoose = require('mongoose');
require('dotenv').config();
const { Animal, PublicProfile } = require('../database/models');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);

  const profile = await PublicProfile.findOne({ id_public: 'CTU8' });
  const existing = profile.animalBreedingLines || {};
  const updated = { ...existing };

  // Line IDs: test=0, test 2=1, test 3=2, test 4=3
  const assignments = {
    3: ['MLD', 'SM'],        // test 4
    0: ['MK', 'Mohanah']    // test (test 1)
  };

  let totalAssigned = 0;
  for (const [lineId, prefixes] of Object.entries(assignments)) {
    const animals = await Animal.find({
      ownerId_public: 'CTU8',
      prefix: { $in: prefixes }
    }).select('id_public prefix').lean();

    for (const a of animals) {
      updated[a.id_public] = [Number(lineId)];
    }
    const lineName = lineId === '0' ? 'test' : 'test 4';
    console.log(`${lineName} (line ${lineId}): ${animals.length} animals (${prefixes.join(', ')})`);
    totalAssigned += animals.length;
  }

  await PublicProfile.updateOne(
    { id_public: 'CTU8' },
    { $set: { animalBreedingLines: updated } }
  );

  console.log(`\nDone! ${totalAssigned} animals assigned.`);
  await mongoose.disconnect();
})();
