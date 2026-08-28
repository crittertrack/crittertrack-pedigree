// Final CTU8 cleanup: replace each animal's ch/- token with its confirmed C-locus genotype.
require('dotenv').config();
const mongoose = require('mongoose');
const { Animal, PublicAnimal } = require('../database/models');
const { buildPublicAnimalFields } = require('../utils/syncPublicAnimals');

const REPLACEMENTS = {
  CTC3285: 'ch/ch',
  CTC3316: 'ce/ch',
  CTC3417: 'ce/ch',
  CTC3418: 'ce/ch',
  CTC3419: 'ce/ch',
};

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);

  for (const [id_public, newAllele] of Object.entries(REPLACEMENTS)) {
    const animal = await Animal.findOne({ id_public });
    if (!animal) {
      console.log(`${id_public}: NOT FOUND`);
      continue;
    }
    const before = animal.geneticCode;
    const after = before.split(/\s+/).map(t => (t === 'ch/-' ? newAllele : t)).join(' ');
    animal.geneticCode = after;
    await animal.save();
    console.log(`${id_public}: "${before}" -> "${after}"`);

    if (animal.isDisplay) {
      await PublicAnimal.updateOne(
        { id_public },
        { $set: buildPublicAnimalFields(animal.toObject()) },
        { upsert: true }
      );
    }
  }

  await mongoose.disconnect();
})();
