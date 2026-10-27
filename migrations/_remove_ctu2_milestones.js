require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const { Animal } = require('../database/models');

const OWNER_ID_PUBLIC = 'CTU2';

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);

  const res = await Animal.updateMany(
    { creatorId_public: OWNER_ID_PUBLIC },
    { $set: { milestones: [] } }
  );
  console.log('Updated animals:', res.modifiedCount);
  await mongoose.disconnect();
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });