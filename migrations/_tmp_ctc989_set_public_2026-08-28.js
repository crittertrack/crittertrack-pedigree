// Set CTC989 (CTU34, Fancy Rat) to public and sync it into PublicAnimal.
require('dotenv').config();
const mongoose = require('mongoose');
const { Animal } = require('../database/models');
const { resyncAnimalToPublicById } = require('../utils/syncPublicAnimals');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);

  const animal = await Animal.findOne({ id_public: 'CTC989' });
  if (!animal) {
    console.log('CTC989 not found');
  } else {
    console.log(`CTC989 isDisplay before: ${animal.isDisplay}`);
    animal.isDisplay = true;
    await animal.save();
    await resyncAnimalToPublicById('CTC989');
    console.log('CTC989 is now public and synced.');
  }

  await mongoose.disconnect();
})();
