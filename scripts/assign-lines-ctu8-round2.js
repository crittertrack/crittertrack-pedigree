const mongoose = require('mongoose');
require('dotenv').config();
const { Animal, PublicProfile } = require('../database/models');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);

  const profile = await PublicProfile.findOne({ id_public: 'CTU8' });
  const existing = profile.animalBreedingLines || {};
  const updated = { ...existing };

  // Line IDs: test 2=1, test 3=2, test 4=3
  const assignments = {
    3: ['CS', 'M3', 'ZC'],       // test 4
    2: ['BE', 'TOM', "Ray's"],   // test 3
    1: ['LB', "Dragon's", 'CoCM'] // test 2
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
    const lineName = lineId === '1' ? 'test 2' : lineId === '2' ? 'test 3' : 'test 4';
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
