require('dotenv').config();
const mongoose = require('mongoose');
const { Animal } = require('../database/models');

const ids = [
  'CTC7597','CTC5040',
  'CTC4390','CTC2997',
  'CTC4381','CTC3001',
  'CTC4389','CTC2966',
  'CTC4465','CTC3661',
  'CTC4912','CTC74',
  'CTC4415','CTC483',
  'CTL381', 'SHELBY'
];

(async () => {
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI is not set');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);

  const rows = await Animal.find({ id_public: { $in: ids } }, {
    _id: 0,
    id_public: 1,
    prefix: 1,
    name: 1,
    suffix: 1,
    species: 1,
    gender: 1,
    birthDate: 1,
    sireId_public: 1,
    damId_public: 1,
    breederAssignedId: 1,
    creatorId: 1,
    ownerId_public: 1,
    breederId_public: 1,
    archived: 1,
    status: 1,
    isDisplay: 1,
    isOwned: 1,
  }).lean();

  console.log('MATCHED_RECORDS');
  console.log(JSON.stringify(rows, null, 2));

  const refs = await Animal.find({
    $or: [
      { sireId_public: 'CTL381' },
      { damId_public: 'CTL381' },
      { sireId_public: 'SHELBY' },
      { damId_public: 'SHELBY' },
      { id_public: 'CTL381' },
      { id_public: 'SHELBY' },
    ]
  }, {
    _id: 0,
    id_public: 1,
    prefix: 1,
    name: 1,
    suffix: 1,
    sireId_public: 1,
    damId_public: 1,
    species: 1,
    gender: 1,
    creatorId: 1,
    breederAssignedId: 1,
  }).lean();

  console.log('RELATED_PARENT_LINKS');
  console.log(JSON.stringify(refs, null, 2));

  await mongoose.disconnect();
})();
