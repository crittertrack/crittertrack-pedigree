require('dotenv').config();
const mongoose = require('mongoose');
const { Animal, User } = require('../database/models');
const { addAnimal } = require('../database/db_service');

(async () => {
    await mongoose.connect(process.env.MONGODB_URI);

    const ctu1 = await User.findOne({ id_public: 'CTU1' }).select('_id id_public').lean();
    if (!ctu1) throw new Error('CTU1 not found');

    // --- Update existing CTC7252 / CTC7257 (Fancy Mouse) with complex genetic codes ---
    const mouseUpdates = [
        {
            id_public: 'CTC7252', // Male
            geneticCode: 'a/a B/b D/d P/p s/s Re/re',
            possibleHets: [{ locus: 'Si', percent: 50 }],
        },
        {
            id_public: 'CTC7257', // Female
            geneticCode: 'Ay/a b/b p/p rst/rst Sa/sa',
            possibleHets: [{ locus: 'Fz', percent: 50 }],
        },
    ];

    for (const update of mouseUpdates) {
        const result = await Animal.findOneAndUpdate(
            { id_public: update.id_public },
            { $set: { geneticCode: update.geneticCode, possibleHets: update.possibleHets } },
            { new: true }
        ).select('id_public name geneticCode possibleHets').lean();
        console.log('Updated', update.id_public, ':', result);
    }

    // --- Create 8 new complex-gene test animals for CTU1 ---
    const newAnimals = [
        // Fancy Rats
        {
            name: 'Complex Rat Buck',
            species: 'Fancy Rat',
            gender: 'Male',
            geneticCode: 'a/a B/b D/d G/g mo/mo h/h Re/re',
            possibleHets: [{ locus: 'hr', percent: 50 }],
        },
        {
            name: 'Complex Rat Doe',
            species: 'Fancy Rat',
            gender: 'Female',
            geneticCode: 'A/a b/b p/p sf/sf sa/sa',
            possibleHets: [{ locus: 'Ro', percent: 50 }],
        },
        // Syrian Hamsters
        {
            name: 'Complex Syrian Male',
            species: 'Syrian Hamster',
            gender: 'Male',
            geneticCode: 'a/a b/b d/d Ba/ba Sa/sa',
            possibleHets: [{ locus: 'rx', percent: 50 }],
        },
        {
            name: 'Complex Syrian Female',
            species: 'Syrian Hamster',
            gender: 'Female',
            geneticCode: 'A/a dg/dg p/p To/to s/s hr/hr',
            possibleHets: [{ locus: 'l', percent: 50 }],
        },
        // Campbell's Dwarf Hamsters
        {
            name: 'Complex Campbells Male',
            species: 'Campbells Dwarf Hamster',
            gender: 'Male',
            geneticCode: 'a/a b/b d/d Mo/mo rx/rx',
            possibleHets: [{ locus: 'wa', percent: 50 }],
        },
        {
            name: 'Complex Campbells Female',
            species: 'Campbells Dwarf Hamster',
            gender: 'Female',
            geneticCode: 'A/a d/d p/p u/u Mi/mi',
            possibleHets: [{ locus: 'di', percent: 50 }],
        },
        // Russian Dwarf Hamsters
        {
            name: 'Complex Russian Male',
            species: 'Russian Dwarf Hamster',
            gender: 'Male',
            geneticCode: 'a/a d/d Pe/pe U/u rx/rx',
            possibleHets: [{ locus: 'm', percent: 50 }],
        },
        {
            name: 'Complex Russian Female',
            species: 'Russian Dwarf Hamster',
            gender: 'Female',
            geneticCode: 'Ma/ma p/p Me/me Mi/mi sa/sa',
            possibleHets: [{ locus: 's', percent: 50 }],
        },
    ];

    for (const animalData of newAnimals) {
        const created = await addAnimal(ctu1._id, { ...animalData, isDisplay: false });
        console.log('Created', created.id_public, created.name, created.species, created.gender, '-', created.geneticCode);
    }

    await mongoose.disconnect();
})();
