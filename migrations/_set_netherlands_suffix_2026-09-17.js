require('dotenv').config();
const mongoose = require('mongoose');
const { Animal, PublicAnimal } = require('../database/models');

const TARGET_IDS = [
  'CTC6162',
  'CTC6160',
  'CTC6161',
  'CTC5549',
  'CTC5547',
  'CTC590',
  'CTC25',
];

const FLAG_SUFFIX = '🇳🇱';

(async () => {
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI is not set.');
    process.exit(1);
  }

  try {
    await mongoose.connect(process.env.MONGODB_URI);

    const animalResult = await Animal.collection.updateMany(
      { id_public: { $in: TARGET_IDS } },
      { $set: { suffix: FLAG_SUFFIX } }
    );

    const publicResult = await PublicAnimal.collection.updateMany(
      { id_public: { $in: TARGET_IDS } },
      { $set: { suffix: FLAG_SUFFIX } }
    );

    console.log('Updated Animal records:', animalResult.modifiedCount, 'matched', animalResult.matchedCount);
    console.log('Updated PublicAnimal records:', publicResult.modifiedCount, 'matched', publicResult.matchedCount);
    console.log('Flag suffix applied:', FLAG_SUFFIX);
    console.log('Target IDs:', TARGET_IDS.join(', '));
  } catch (err) {
    console.error('Failed to update Dutch-flag suffixes:', err);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
})();
