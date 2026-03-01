require('dotenv').config();
const mongoose = require('mongoose');

mongoose.connect(process.env.MONGODB_URI || process.env.DB_URI).then(async () => {
    const { Animal, PublicAnimal } = require('./database/models');
    const { calculateInbreedingCoefficient } = require('./utils/inbreeding');

    const fetchAnimal = async (id) => {
        let a = await Animal.findOne({ id_public: id }).lean();
        if (!a) a = await PublicAnimal.findOne({ id_public: id }).lean();
        return a;
    };

    // Process CTC953 first — it's the sire of CTC311
    const ids = ['CTC953', 'CTC276', 'CTC281', 'CTC301', 'CTC304', 'CTC311', 'CTC400', 'CTC527', 'CTC1860'];

    for (const id of ids) {
        try {
            // Use 10 generations — deep enough for real pedigrees, avoids infinite loops
            const coeff = await calculateInbreedingCoefficient(id, fetchAnimal, 10);
            await Animal.updateOne({ id_public: id }, { inbreedingCoefficient: coeff });
            await PublicAnimal.updateOne({ id_public: id }, { inbreedingCoefficient: coeff });
            console.log(`${id} -> ${coeff}`);
        } catch (e) {
            console.log(`${id} ERROR: ${e.message}`);
        }
    }

    const remaining = await Animal.countDocuments({ inbreedingCoefficient: null });
    console.log(`\nDone. Remaining null: ${remaining}`);
    await mongoose.disconnect();
});
