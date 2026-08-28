require('dotenv').config();
const mongoose = require('mongoose');
const { Animal, User } = require('../database/models');

(async () => {
    await mongoose.connect(process.env.MONGODB_URI);

    for (const id of ['CTC7252', 'CTC7257']) {
        const animal = await Animal.findOne({ id_public: id }).select('id_public name species gender geneticCode possibleHets creatorId_public').lean();
        console.log(id, ':', animal || 'NOT FOUND');
    }

    const ctu1 = await User.findOne({ id_public: 'CTU1' }).select('_id id_public').lean();
    console.log('CTU1:', ctu1);

    await mongoose.disconnect();
})();
