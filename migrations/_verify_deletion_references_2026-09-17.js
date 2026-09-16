require('dotenv').config();
const mongoose = require('mongoose');
const { Animal, PublicAnimal, Litter, AnimalLog, Notification, Transaction } = require('../database/models');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const ids = ['CTC7597','CTC4390','CTC4381','CTC4389','CTC4465','CTC4912','CTC4415'];
  const checks = [];

  const animalRefs = await Animal.countDocuments({ $or: [{ sireId_public: { $in: ids } }, { damId_public: { $in: ids } }, { id_public: { $in: ids } }] });
  const publicRefs = await PublicAnimal.countDocuments({ $or: [{ sireId_public: { $in: ids } }, { damId_public: { $in: ids } }, { id_public: { $in: ids } }] });
  const litterRefs = await Litter.countDocuments({ $or: [{ sireId_public: { $in: ids } }, { damId_public: { $in: ids } }, { offspringIds_public: { $in: ids } }] });
  const animalLogRefs = await AnimalLog.countDocuments({ animalId_public: { $in: ids } });
  const notificationRefs = await Notification.countDocuments({ $or: [{ animalId_public: { $in: ids } }, { targetAnimalId_public: { $in: ids } }] });
  const transactionRefs = await Transaction.countDocuments({ animalId: { $in: ids } });

  console.log('animalRefs', animalRefs);
  console.log('publicRefs', publicRefs);
  console.log('litterRefs', litterRefs);
  console.log('animalLogRefs', animalLogRefs);
  console.log('notificationRefs', notificationRefs);
  console.log('transactionRefs', transactionRefs);

  const ctc483 = await Animal.findOne({ id_public: 'CTC483' }, { _id: 0, id_public: 1, sireId_public: 1, damId_public: 1 }).lean();
  console.log('CTC483 parent links', JSON.stringify(ctc483));
  const parentLinks = await Animal.find({ $or: [{ sireId_public: 'CTL381' }, { damId_public: 'CTL381' }, { sireId_public: 'SHELBY' }, { damId_public: 'SHELBY' }] }, { _id: 0, id_public: 1, sireId_public: 1, damId_public: 1 }).lean();
  console.log('CTL381/SHELBY parent link hits', JSON.stringify(parentLinks));

  await mongoose.disconnect();
})();
