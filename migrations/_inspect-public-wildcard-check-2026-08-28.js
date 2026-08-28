require('dotenv').config();
const mongoose = require('mongoose');
const { PublicAnimal } = require('../database/models');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const n = await PublicAnimal.countDocuments({
    creatorId_public: { $in: ['CTU2', 'CTU8', 'CTU6', 'CTU11', 'CTU28', 'CTU114'] },
    geneticCode: { $regex: /\/-/ },
  });
  console.log('Remaining wildcard PublicAnimal docs for these 6 users:', n);
  await mongoose.disconnect();
})();
