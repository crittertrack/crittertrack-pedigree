require('dotenv').config();
const mongoose = require('mongoose');
const { Animal } = require('../database/models');

(async () => {
    await mongoose.connect(process.env.MONGODB_URI);

    // Check the ones we found
    const found = ['CTC222', 'CTC39', 'CTC46', 'CTC43'];
    for (const id of found) {
        const a = await Animal.findOne({ id_public: id }, { id_public: 1, name: 1, prefix: 1, ownerId_public: 1, breederId_public: 1, sireId_public: 1, damId_public: 1 }).lean();
        if (a) console.log(`${a.id_public}  prefix="${a.prefix}"  name="${a.name}"  owner=${a.ownerId_public}  breeder=${a.breederId_public}  sire=${a.sireId_public}  dam=${a.damId_public}`);
    }

    // Also search DA prefix animals
    const daAnimals = await Animal.find({ prefix: 'DA' }, { id_public: 1, name: 1, prefix: 1, ownerId_public: 1 }).lean();
    console.log('\nDA prefix animals:', daAnimals.length);
    daAnimals.forEach(a => console.log(`  ${a.id_public}  "${a.name}"  owner=${a.ownerId_public}`));

    await mongoose.disconnect();
})();
