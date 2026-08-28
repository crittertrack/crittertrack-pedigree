require('dotenv').config();
const mongoose = require('mongoose');
const { Animal, User } = require('../database/models');

(async () => {
    await mongoose.connect(process.env.MONGODB_URI);

    const ctu1 = await User.findOne({ id_public: 'CTU1' }).select('_id id_public').lean();
    console.log('CTU1:', ctu1);

    const animals = await Animal.find({ creatorId_public: 'CTU1', species: 'Ball Python' })
        .select('id_public name species gender geneticCode possibleHets')
        .lean();

    console.log(`Found ${animals.length} Ball Python animal(s) for CTU1:`);
    for (const a of animals) {
        console.log(JSON.stringify(a, null, 2));
    }

    await mongoose.disconnect();
})();
