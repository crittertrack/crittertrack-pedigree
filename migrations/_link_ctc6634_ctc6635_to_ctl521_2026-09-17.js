require('dotenv').config();
const mongoose = require('mongoose');
const { Animal, Litter } = require('../database/models');

const TARGET_IDS = ['CTC6634', 'CTC6635'];
const LITTER_ID_PUBLIC = 'CTL521';

(async () => {
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI is not set.');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);

  try {
    const litter = await Litter.findOne({ litter_id_public: LITTER_ID_PUBLIC }).lean();
    if (!litter) {
      throw new Error(`Litter ${LITTER_ID_PUBLIC} was not found.`);
    }

    const updatedOffspringIds = [...new Set([...(litter.offspringIds_public || []), ...TARGET_IDS])];

    await Litter.updateOne(
      { litter_id_public: LITTER_ID_PUBLIC },
      {
        $set: {
          offspringIds_public: updatedOffspringIds,
        },
      }
    );

    for (const id of TARGET_IDS) {
      const animal = await Animal.findOne({ id_public: id });
      if (!animal) {
        console.warn(`Animal ${id} not found; skipping direct litter link.`);
        continue;
      }

      const breedingRecordAlreadyLinked = (animal.breedingRecords || []).some(
        record => record && record.litterId === LITTER_ID_PUBLIC
      );

      const update = {
        $set: { litterId: litter._id },
      };

      if (!breedingRecordAlreadyLinked) {
        update.$addToSet = {
          breedingRecords: {
            litterId: LITTER_ID_PUBLIC,
            outcome: 'Successful',
            birthEventDate: litter.birthDate || null,
            matingDate: litter.matingDate || null,
            notes: `Linked to litter ${LITTER_ID_PUBLIC}`,
          },
        };
      }

      await Animal.updateOne({ _id: animal._id }, update);
      console.log(`Linked ${id} to ${LITTER_ID_PUBLIC}`);
    }

    const offspringAnimals = await Animal.find({ id_public: { $in: updatedOffspringIds } }, { gender: 1 }).lean();
    const counts = { maleCount: 0, femaleCount: 0, unknownCount: 0 };
    for (const animal of offspringAnimals) {
      if (animal.gender === 'Male') counts.maleCount += 1;
      else if (animal.gender === 'Female') counts.femaleCount += 1;
      else counts.unknownCount += 1;
    }

    await Litter.updateOne(
      { litter_id_public: LITTER_ID_PUBLIC },
      {
        $set: {
          offspringIds_public: updatedOffspringIds,
          litterSizeBorn: updatedOffspringIds.length,
          numberBorn: updatedOffspringIds.length,
          maleCount: counts.maleCount,
          femaleCount: counts.femaleCount,
          unknownCount: counts.unknownCount,
        },
      }
    );

    console.log(JSON.stringify({
      litter_id_public: LITTER_ID_PUBLIC,
      linkedIds: TARGET_IDS,
      updatedOffspringIds,
      counts,
    }, null, 2));
  } finally {
    await mongoose.disconnect();
  }
})();
