require('dotenv').config();
const mongoose = require('mongoose');
const { PublicAnimal } = require('../database/models');

const IDS = ['CTC5487', 'CTC5492', 'CTC6190', 'CTC6191', 'CTC7062', 'CTC7100', 'CTC7187', 'CTC7188', 'CTC7239', 'CTC7244', 'CTC7246'];

(async () => {
    await mongoose.connect(process.env.MONGODB_URI);

    const publics = await PublicAnimal.find({ id_public: { $in: IDS } }).select('id_public').lean();
    const publicSet = new Set(publics.map(p => p.id_public));

    IDS.forEach(id => console.log(`${id}\thas PublicAnimal record: ${publicSet.has(id)}`));

    await mongoose.disconnect();
})();
