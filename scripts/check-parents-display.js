require('dotenv').config();
const mongoose = require('mongoose');
const { Animal } = require('../database/models');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB\n');
  
  // Check CTC4688
  const ctc4688 = await Animal.findOne({ id_public: 'CTC4688' }, { 
    id_public: 1, name: 1, 
    sireId_public: 1, damId_public: 1,
    fatherId_public: 1, motherId_public: 1
  }).lean();
  
  console.log('=== CTC4688 ===');
  console.log('sireId_public:', ctc4688.sireId_public);
  console.log('damId_public:', ctc4688.damId_public);
  console.log('fatherId_public:', ctc4688.fatherId_public);
  console.log('motherId_public:', ctc4688.motherId_public);
  
  // Check a few other animals for comparison
  console.log('\n=== Other animals with parents ===');
  const others = await Animal.find(
    { $or: [
      { sireId_public: { $exists: true, $ne: null } },
      { damId_public: { $exists: true, $ne: null } }
    ]},
    { id_public: 1, name: 1, sireId_public: 1, damId_public: 1, ownerId_public: 1 }
  ).limit(5).lean();
  
  others.forEach(o => console.log(`${o.id_public} ${o.name} sire=${o.sireId_public} dam=${o.damId_public} owner=${o.ownerId_public}`));
  
  await mongoose.disconnect();
})();
