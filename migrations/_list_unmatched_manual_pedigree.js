require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const { Animal } = require('../database/models');
const fs = require('fs');
(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const cursor = Animal.find({ manualPedigree: { $exists: true, $ne: null } });
  const out = [];
  for await (const doc of cursor) {
    const mp = doc.manualPedigree || {};
    const sireCtc = mp.sire && mp.sire.mode === 'ctc' && mp.sire.ctcId;
    const damCtc = mp.dam && mp.dam.mode === 'ctc' && mp.dam.ctcId;
    if (!sireCtc && !damCtc) {
      out.push(`${doc.id_public}\t${doc.name}\t${doc.creatorId_public}\t${JSON.stringify(mp)}`);
    }
  }
  fs.writeFileSync('manual_pedigree_unmatched.txt', out.join('\n'));
  console.log('Unmatched:', out.length);
  await mongoose.disconnect();
})().catch(e => { console.error(e); process.exit(1); });