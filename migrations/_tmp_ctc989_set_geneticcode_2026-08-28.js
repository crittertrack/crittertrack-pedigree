// Set CTC989's confirmed genetic code (Mink Silvermane Dumbo Irish) — the D-/G-/B-/P-/R-locus
// wildcards are intentionally left as-is (owner can't confirm them, doesn't want them stripped).
require('dotenv').config();
const mongoose = require('mongoose');
const { Animal, PublicAnimal } = require('../database/models');
const { buildPublicAnimalFields } = require('../utils/syncPublicAnimals');

const NEW_CODE = 'a/a B/- C/ch D- G- m/m P/- pe/- R/- Sm/sm du/du';

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);

  const animal = await Animal.findOne({ id_public: 'CTC989' });
  if (!animal) {
    console.log('CTC989 not found');
  } else {
    console.log(`before: ${animal.geneticCode}`);
    animal.geneticCode = NEW_CODE;
    await animal.save();
    console.log(`after:  ${animal.geneticCode}`);

    if (animal.isDisplay) {
      await PublicAnimal.updateOne(
        { id_public: 'CTC989' },
        { $set: buildPublicAnimalFields(animal.toObject()) },
        { upsert: true }
      );
      console.log('Synced to PublicAnimal.');
    }
  }

  await mongoose.disconnect();
})();
