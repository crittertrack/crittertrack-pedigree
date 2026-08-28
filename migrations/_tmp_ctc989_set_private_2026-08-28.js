// Revert CTC989 back to private.
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
    animal.isDisplay = false;
    await animal.save();
    await resyncAnimalToPublicById('CTC989');
    console.log('CTC989 is now private again.');
  }

  await mongoose.disconnect();
})();
