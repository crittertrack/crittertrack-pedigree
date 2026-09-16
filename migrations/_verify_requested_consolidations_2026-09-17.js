require('dotenv').config();
const mongoose = require('mongoose');
const { Animal, PublicAnimal } = require('../database/models');

(async () => {
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI is not set');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);

  const ids = [
    'CTC7597','CTC5040',
    'CTC4390','CTC2997',
    'CTC4381','CTC3001',
    'CTC4389','CTC2966',
    'CTC4465','CTC3661',
    'CTC4912','CTC74',
    'CTC4415','CTC483'
  ];

  const animalRows = await Animal.find({ id_public: { $in: ids } }, {
    _id: 0,
    id_public: 1,
    prefix: 1,
    name: 1,
    suffix: 1,
    sireId_public: 1,
    damId_public: 1,
  }).lean();

  const publicRows = await PublicAnimal.find({ id_public: { $in: ids } }, {
    _id: 0,
    id_public: 1,
    prefix: 1,
    name: 1,
    suffix: 1,
    sireId_public: 1,
    damId_public: 1,
  }).lean();

  const remainingDeleteIds = ids.filter((id) => !animalRows.some(r => r.id_public === id) && !publicRows.some(r => r.id_public === id));
  const ctc483 = await Animal.findOne({ id_public: 'CTC483' }, {
    _id: 0,
    id_public: 1,
    name: 1,
    prefix: 1,
    suffix: 1,
    sireId_public: 1,
    damId_public: 1,
  }).lean();

  console.log('ANIMAL_MATCHES', JSON.stringify(animalRows, null, 2));
  console.log('PUBLIC_MATCHES', JSON.stringify(publicRows, null, 2));
  console.log('REMAINING_DELETE_IDS', JSON.stringify(remainingDeleteIds));
  console.log('CTC483_PARENT_LINKS', JSON.stringify(ctc483, null, 2));

  await mongoose.disconnect();
})();
