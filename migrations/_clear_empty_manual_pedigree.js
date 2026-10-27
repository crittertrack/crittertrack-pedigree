require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const { Animal } = require('../database/models');
(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const res = await Animal.updateMany({ manualPedigree: {} }, { $unset: { manualPedigree: '' } });
  console.log('Cleared empty manualPedigree:', res.modifiedCount);
  await mongoose.disconnect();
})().catch(e => { console.error(e); process.exit(1); });