require('dotenv').config();
const mongoose = require('mongoose');
const { User, Animal, PublicAnimal } = require('../database/models');
const { resyncAnimalToPublicById } = require('../utils/syncPublicAnimals');

const IDS = ['CTC816', 'CTC815'];
const BREEDER_NAME = 'Pvk Paula van Kleef';

(async () => {
    await mongoose.connect(process.env.MONGODB_URI);

    const users = await User.find({
        $or: [{ personalName: /paula van kleef/i }, { breederName: /pvk|paula van kleef/i }]
    }).select('id_public personalName breederName').lean();
    console.log('Matching registered users (none expected):', users);

    for (const id of IDS) {
        const animal = await Animal.findOne({ id_public: id });
        if (!animal) {
            console.log(`${id}: NOT FOUND`);
            continue;
        }
        console.log(`${id} before:`, { breederId_public: animal.breederId_public, manualBreederName: animal.manualBreederName });

        animal.breederId_public = null;
        animal.manualBreederName = BREEDER_NAME;
        await animal.save();

        await resyncAnimalToPublicById(id);

        const pub = await PublicAnimal.findOne({ id_public: id }).select('breederId_public manualBreederName').lean();
        console.log(`${id} after (Animal):`, { breederId_public: animal.breederId_public, manualBreederName: animal.manualBreederName });
        console.log(`${id} after (PublicAnimal):`, pub || 'no PublicAnimal record');
    }

    await mongoose.disconnect();
})();
