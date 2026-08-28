// Mongoose strict mode silently dropped $unset for 'size' once the schema no longer declared
// that path. Use the raw collection driver (bypasses schema casting) to force-remove it.
require('dotenv').config();
const mongoose = require('mongoose');
const { Animal, PublicAnimal } = require('../database/models');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);

  const a = await Animal.collection.updateMany({ size: { $exists: true } }, { $unset: { size: '' } });
  const p = await PublicAnimal.collection.updateMany({ size: { $exists: true } }, { $unset: { size: '' } });
  console.log('Animal unset count:', a.modifiedCount);
  console.log('PublicAnimal unset count:', p.modifiedCount);

  await mongoose.disconnect();
})();
