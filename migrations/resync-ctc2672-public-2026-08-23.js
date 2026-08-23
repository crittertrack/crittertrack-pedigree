require('dotenv').config();
const mongoose = require('mongoose');
const { PublicAnimal } = require('../database/models');
const { resyncAnimalToPublicById } = require('../utils/syncPublicAnimals');

(async () => {
    await mongoose.connect(process.env.MONGODB_URI);

    const before = await PublicAnimal.findOne({ id_public: 'CTC2672' }).select('manualBreederName breederId_public').lean();
    console.log('PublicAnimal before:', before);

    if (before) {
        await resyncAnimalToPublicById('CTC2672');
        const after = await PublicAnimal.findOne({ id_public: 'CTC2672' }).select('manualBreederName breederId_public').lean();
        console.log('PublicAnimal after:', after);
    } else {
        console.log('No PublicAnimal record for CTC2672 — not the cause.');
    }

    await mongoose.disconnect();
})();
