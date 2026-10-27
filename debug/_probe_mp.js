require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const { Animal } = require('../database/models');
(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const a = await Animal.findOne({ creatorId_public: 'CTU2', manualPedigree: { $exists: true, $ne: null } }).lean();
  // ensure not empty
  if (a && (!a.manualPedigree || Object.keys(a.manualPedigree).length === 0)) {
    // find next
    const cursor = Animal.find({ creatorId_public: 'CTU2', manualPedigree: { $exists: true, $ne: null } }).lean();
    for await (const doc of cursor) {
      if (doc.manualPedigree && Object.keys(doc.manualPedigree).length) {
        console.log(JSON.stringify(doc.manualPedigree, null, 2));
        console.log('id', doc.id_public, doc.name);
        break;
      }
    }
  } else {
    console.log(JSON.stringify(a?.manualPedigree, null, 2));
    console.log('id', a?.id_public, a?.name);
  }
  await mongoose.disconnect();
})().catch(e => { console.error(e); process.exit(1); });