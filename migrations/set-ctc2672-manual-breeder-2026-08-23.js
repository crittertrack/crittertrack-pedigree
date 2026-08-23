require('dotenv').config();
const mongoose = require('mongoose');
const { Animal } = require('../database/models');

(async () => {
    await mongoose.connect(process.env.MONGODB_URI);

    const animal = await Animal.findOne({ id_public: 'CTC2672' });
    console.log('Before:', { breederId_public: animal.breederId_public, manualBreederName: animal.manualBreederName });

    animal.breederId_public = null;
    animal.manualBreederName = 'Marion GebStock (M3 Rodentry)';
    await animal.save();

    console.log('After:', { breederId_public: animal.breederId_public, manualBreederName: animal.manualBreederName });

    await mongoose.disconnect();
})();
