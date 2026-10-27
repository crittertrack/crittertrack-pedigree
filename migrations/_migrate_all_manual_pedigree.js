require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const { Animal } = require('../database/models');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const cursor = Animal.find({ manualPedigree: { $exists: true, $ne: null } });
  let updated = 0, scanned = 0;
  for await (const doc of cursor) {
    scanned++;
    const mp = doc.manualPedigree || {};
    const update = {};
    if (mp.sire && mp.sire.mode === 'ctc' && mp.sire.ctcId) update.sireId_public = mp.sire.ctcId;
    if (mp.dam && mp.dam.mode === 'ctc' && mp.dam.ctcId) update.damId_public = mp.dam.ctcId;
    if (Object.keys(update).length) {
      update.manualPedigree = null;
      await Animal.updateOne({ _id: doc._id }, { $set: update });
      updated++;
    }
  }
  console.log('Scanned:', scanned, 'Migrated:', updated);
  await mongoose.disconnect();
})().catch(e => { console.error(e); process.exit(1); });