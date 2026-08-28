require('dotenv').config();
const mongoose = require('mongoose');
const { Animal, PublicAnimal } = require('../database/models');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const a = await Animal.countDocuments({ size: { $exists: true } });
  const p = await PublicAnimal.countDocuments({ size: { $exists: true } });
  const ab = await Animal.countDocuments({ body: { $exists: true, $ne: null } });
  const pb = await PublicAnimal.countDocuments({ body: { $exists: true, $ne: null } });
  console.log({ remainingAnimalSize: a, remainingPublicAnimalSize: p, animalWithBody: ab, publicAnimalWithBody: pb });
  await mongoose.disconnect();
})();
