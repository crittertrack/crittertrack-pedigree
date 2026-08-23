require('dotenv').config();
const mongoose = require('mongoose');
const { Animal, PublicAnimal } = require('../database/models');
const { resyncAnimalToPublicById } = require('../utils/syncPublicAnimals');

const IDS = ['CTC816', 'CTC815'];
const NEW_PREFIX = 'Pvk';

(async () => {
    await mongoose.connect(process.env.MONGODB_URI);

    for (const id of IDS) {
        const animal = await Animal.findOne({ id_public: id });
        if (!animal) {
            console.log(`${id}: NOT FOUND`);
            continue;
        }
        console.log(`${id} before:`, { prefix: animal.prefix });

        animal.prefix = NEW_PREFIX;
        await animal.save();

        await resyncAnimalToPublicById(id);

        const pub = await PublicAnimal.findOne({ id_public: id }).select('prefix').lean();
        console.log(`${id} after (Animal):`, { prefix: animal.prefix });
        console.log(`${id} after (PublicAnimal):`, pub || 'no PublicAnimal record');
    }

    await mongoose.disconnect();
})();
