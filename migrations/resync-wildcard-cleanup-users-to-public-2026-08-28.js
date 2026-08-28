// Resync PublicAnimal mirrors for the 6 users whose geneticCode wildcards we just cleaned up —
// the earlier migrations wrote directly to Animal via bulkWrite, bypassing the normal
// resyncAnimalToPublic() call, so PublicAnimal is now stale for these users' geneticCode field.
require('dotenv').config();
const mongoose = require('mongoose');
const { Animal, PublicAnimal } = require('../database/models');
const { buildPublicAnimalFields } = require('../utils/syncPublicAnimals');

const USER_IDS = ['CTU2', 'CTU8', 'CTU6', 'CTU11', 'CTU28', 'CTU114'];

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);

  const animals = await Animal.find({ creatorId_public: { $in: USER_IDS } }).lean();
  console.log(`Animals found: ${animals.length}`);

  const displayAnimals = animals.filter(a => a.isDisplay);
  const hiddenAnimals = animals.filter(a => !a.isDisplay);

  if (displayAnimals.length > 0) {
    const bulkOps = displayAnimals.map(a => ({
      updateOne: {
        filter: { id_public: a.id_public },
        update: { $set: buildPublicAnimalFields(a) },
        upsert: true,
      },
    }));
    const result = await PublicAnimal.bulkWrite(bulkOps);
    console.log(`Upserted into PublicAnimal: ${result.upsertedCount + result.modifiedCount}`);
  }

  if (hiddenAnimals.length > 0) {
    const result = await PublicAnimal.deleteMany({ id_public: { $in: hiddenAnimals.map(a => a.id_public) } });
    console.log(`Removed stale non-display PublicAnimal docs: ${result.deletedCount}`);
  }

  await mongoose.disconnect();
})();
