require('dotenv').config();
const mongoose = require('mongoose');
const { Animal } = require('../database/models');

(async () => {
    await mongoose.connect(process.env.MONGODB_URI);

    const updates = [
        {
            id: 'CTC7449',
            geneticCode: 'Pas/pas pi/pi',
            possibleHets: [{ locus: 'cl', percent: 50 }],
        },
        {
            id: 'CTC7450',
            geneticCode: 'Sp/sp cl/cl',
            possibleHets: [{ locus: 'pi', percent: 66 }],
        },
    ];

    for (const { id, geneticCode, possibleHets } of updates) {
        const res = await Animal.updateOne(
            { id_public: id },
            { $set: { geneticCode, possibleHets } }
        );
        console.log(id, '->', geneticCode, '| possibleHets:', JSON.stringify(possibleHets), '| matched:', res.matchedCount, 'modified:', res.modifiedCount);
    }

    await mongoose.disconnect();
})();
