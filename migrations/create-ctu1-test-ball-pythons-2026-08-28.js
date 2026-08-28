const mongoose = require('mongoose');
require('dotenv').config();
const { User } = require('../database/models');
const { addAnimal } = require('../database/db_service');

async function main() {
    await mongoose.connect(process.env.MONGODB_URI);

    const ctu1 = await User.findOne({ id_public: 'CTU1' }).select('_id id_public').lean();
    if (!ctu1) throw new Error('CTU1 not found');

    // Male: BEL complex (Lesser + Mojave -> Blue-Eyed Leucistic) + Cinnamon/Black Pastel
    // compound + Pastel + Piebald (visible recessive) + Spider, plus a possible het note.
    const male = await addAnimal(ctu1._id, {
        name: 'Test Male BP',
        species: 'Ball Python',
        gender: 'Male',
        geneticCode: 'Les/les Moj/moj Bp/Cin Pas/pas pi/pi Sp/sp',
        possibleHets: [{ locus: 'cl', percent: 50 }],
        isDisplay: false,
    });

    // Female: Albino/Candy compound (Candino) + Lace/GHI compound + Champagne + Vanilla +
    // Clown (visible recessive), plus a possible het note.
    const female = await addAnimal(ctu1._id, {
        name: 'Test Female BP',
        species: 'Ball Python',
        gender: 'Female',
        geneticCode: 'Alb/Cdy Ghi/Lac Cha/cha Van/van cl/cl',
        possibleHets: [{ locus: 'pi', percent: 66 }],
        isDisplay: false,
    });

    console.log('Created:', male.id_public, male.name, male.gender, male.geneticCode, male.possibleHets);
    console.log('Created:', female.id_public, female.name, female.gender, female.geneticCode, female.possibleHets);

    await mongoose.disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
