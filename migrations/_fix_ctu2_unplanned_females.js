require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const { Animal } = require('../database/models');

const OWNER_ID_PUBLIC = 'CTU2';

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);

  const names = [
    'Aiko', 'Zabou', 'Ditzy', 'Jasmine', 'Juno', 'Harmony', 'Spooky',
    'Fairytale', 'Vixen', 'Eika', 'Demi', 'Dulcie', 'Ayla', 'Fancy Cowgirl',
    'Foolish Calamity', 'Ravenna', 'Caspian', 'Bonbon'
  ];
  const filter = { creatorId_public: OWNER_ID_PUBLIC, gender: 'Female', name: { $in: names } };
  const update = { $set: { isInMating: false, isPlannedMating: true, isPregnant: false, isNursing: false } };
  const res = await Animal.updateMany(filter, update);
  console.log('Updated animals:', res.modifiedCount);
  await mongoose.disconnect();
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });

