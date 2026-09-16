require('dotenv').config();
const mongoose = require('mongoose');
const {
  Animal,
  PublicAnimal,
  Litter,
  AnimalLog,
  Transaction,
  Notification,
  User,
} = require('../database/models');

const MERGES = [
  { keepId: 'CTC5040', deleteId: 'CTC7597' },
  { keepId: 'CTC2997', deleteId: 'CTC4390' },
  { keepId: 'CTC3001', deleteId: 'CTC4381' },
  { keepId: 'CTC2966', deleteId: 'CTC4389' },
  { keepId: 'CTC3661', deleteId: 'CTC4465' },
  { keepId: 'CTC74', deleteId: 'CTC4912' },
  { keepId: 'CTC483', deleteId: 'CTC4415' },
];

async function mergeAnimalPair({ keepId, deleteId }) {
  const [keepAnimal, deleteAnimalDoc] = await Promise.all([
    Animal.findOne({ id_public: keepId }).lean(),
    Animal.findOne({ id_public: deleteId }).lean(),
  ]);

  if (!keepAnimal || !deleteAnimalDoc) {
    console.log(`SKIP ${deleteId} -> ${keepId}: missing record(s)`);
    return;
  }

  if (keepId === 'CTC483') {
    await Promise.all([
      Animal.updateOne({ id_public: keepId }, { $set: { sireId_public: null, damId_public: null } }),
      PublicAnimal.updateOne({ id_public: keepId }, { $set: { sireId_public: null, damId_public: null } }),
    ]);
  }

  await Promise.all([
    Animal.updateMany({ sireId_public: deleteId }, { $set: { sireId_public: keepId } }),
    Animal.updateMany({ damId_public: deleteId }, { $set: { damId_public: keepId } }),
    Litter.updateMany({ sireId_public: deleteId }, { $set: { sireId_public: keepId } }),
    Litter.updateMany({ damId_public: deleteId }, { $set: { damId_public: keepId } }),
    PublicAnimal.updateMany({ sireId_public: deleteId }, { $set: { sireId_public: keepId } }),
    PublicAnimal.updateMany({ damId_public: deleteId }, { $set: { damId_public: keepId } }),
    AnimalLog.updateMany({ animalId_public: deleteId }, { $set: { animalId_public: keepId, animalId: keepAnimal._id } }),
    Transaction.updateMany({ animalId: deleteId }, { $set: { animalId: keepId } }),
    Notification.updateMany({ animalId_public: deleteId }, { $set: { animalId_public: keepId } }),
    Notification.updateMany({ targetAnimalId_public: deleteId }, { $set: { targetAnimalId_public: keepId } }),
  ]);

  await Litter.updateMany({ offspringIds_public: deleteId }, { $addToSet: { offspringIds_public: keepId } });
  await Litter.updateMany({ offspringIds_public: deleteId }, { $pull: { offspringIds_public: deleteId } });

  await User.updateMany({ ownedAnimals: deleteAnimalDoc._id }, { $pull: { ownedAnimals: deleteAnimalDoc._id } });

  await Animal.deleteOne({ _id: deleteAnimalDoc._id });
  await PublicAnimal.deleteOne({ id_public: deleteId });

  console.log(`MERGED ${deleteId} -> ${keepId}`);
}

(async () => {
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI is not set.');
    process.exit(1);
  }

  try {
    await mongoose.connect(process.env.MONGODB_URI);

    for (const pair of MERGES) {
      await mergeAnimalPair(pair);
    }

    console.log('REQUESTED CONSOLIDATIONS COMPLETE');
  } catch (error) {
    console.error('Failed to consolidate requested duplicates:', error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
})();
