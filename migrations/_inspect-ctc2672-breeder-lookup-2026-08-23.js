require('dotenv').config();
const mongoose = require('mongoose');
const { User, Animal } = require('../database/models');

(async () => {
    await mongoose.connect(process.env.MONGODB_URI);

    const users = await User.find({
        $or: [
            { personalName: /marion/i },
            { breederName: /marion|m3 rodentry/i }
        ]
    }).select('id_public personalName breederName').lean();
    console.log('Matching users:', users);

    const animal = await Animal.findOne({ id_public: 'CTC2672' }).select('id_public name creatorId_public breederId_public');
    console.log('Animal CTC2672:', animal ? {
        id_public: animal.id_public,
        name: animal.name,
        creatorId_public: animal.creatorId_public,
        breederId_public: animal.breederId_public
    } : 'NOT FOUND');

    await mongoose.disconnect();
})();
