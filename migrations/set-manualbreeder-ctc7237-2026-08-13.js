require('dotenv').config();
const mongoose = require('mongoose');
const { Animal, PublicAnimal } = require('../database/models');

(async () => {
    await mongoose.connect(process.env.MONGODB_URI);

    const result = await Animal.updateOne({ id_public: 'CTC7237' }, { $set: { manualBreederName: 'Cozy Comet (CZ)' } });
    const publicResult = await PublicAnimal.updateOne({ id_public: 'CTC7237' }, { $set: { manualBreederName: 'Cozy Comet (CZ)' } });

    console.log(`CTC7237 -> manualBreederName "Cozy Comet (CZ)" (animal modified: ${result.modifiedCount}, public modified: ${publicResult.modifiedCount})`);

    await mongoose.disconnect();
})();
