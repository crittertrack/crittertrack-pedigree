require('dotenv').config();
const mongoose = require('mongoose');
const { Animal, User } = require('../database/models');

(async () => {
    await mongoose.connect(process.env.MONGODB_URI);
    const user = await User.findOne({ id_public: 'CTU2' });
    if (!user) { console.log('CTU2 user not found'); process.exit(1); }

    console.log('breedingLineDefs:', JSON.stringify(user.breedingLineDefs, null, 2));
    const assign = user.animalBreedingLines || {};
    const assignedIds = Object.keys(assign);
    console.log('Total animals with any breeding line assignment:', assignedIds.length);
    console.log('Sample assignments (first 15):');
    assignedIds.slice(0, 15).forEach(id => console.log(' ', id, '->', assign[id]));

    const totalAnimals = await Animal.countDocuments({ creatorId: user._id });
    console.log('Total CTU2 animals (active, non-archived filter not applied):', totalAnimals);

    // Sample pedigree depth check on a few assigned animals
    for (const id of assignedIds.slice(0, 5)) {
        const a = await Animal.findOne({ id_public: id });
        if (!a) { console.log(id, '-> ANIMAL NOT FOUND (may be archived/deleted)'); continue; }
        console.log(id, a.name, '| sire:', a.sireId_public, '| dam:', a.damId_public, '| manualPedigree:', !!a.manualPedigree);
    }

    await mongoose.disconnect();
})();
