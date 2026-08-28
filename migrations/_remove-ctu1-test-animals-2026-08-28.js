// Migration: remove the 10 CTU1 test-fixture animals (2 Ball Pythons + 8 "Complex ___" seed animals)
// Dry-run by default; pass --apply to write changes.
require('dotenv').config();
const mongoose = require('mongoose');
const { Animal, PublicAnimal } = require('../database/models');

const IDS_TO_DELETE = [
    'CTC7449', 'CTC7450', // Test Male BP / Test Female BP
    'CTC7455', 'CTC7456', 'CTC7457', 'CTC7458', 'CTC7459', 'CTC7460', 'CTC7461', 'CTC7462', // Complex ___
];

const APPLY = process.argv.includes('--apply');

async function main() {
    await mongoose.connect(process.env.MONGODB_URI);

    // Safety check: make sure none of these IDs are used as a parent by any OTHER animal (not in our delete list)
    const referencingChildren = await Animal.find({
        $or: [
            { sireId_public: { $in: IDS_TO_DELETE } },
            { damId_public: { $in: IDS_TO_DELETE } },
        ],
        id_public: { $nin: IDS_TO_DELETE },
    }).select('id_public name sireId_public damId_public');

    if (referencingChildren.length > 0) {
        console.log('ABORTING: found animals outside the delete list that reference these IDs as a parent:');
        referencingChildren.forEach(c => console.log(`  ${c.id_public} "${c.name}" sire=${c.sireId_public} dam=${c.damId_public}`));
        await mongoose.disconnect();
        return;
    }
    console.log('Safety check passed: no other animal references these IDs as a parent.\n');

    const animals = await Animal.find({ id_public: { $in: IDS_TO_DELETE } }).select('id_public name species');
    const publicAnimals = await PublicAnimal.find({ id_public: { $in: IDS_TO_DELETE } }).select('id_public name species');

    console.log(`Animal collection: ${animals.length} matching docs`);
    animals.forEach(a => console.log(`  ${a.id_public} "${a.name}" (${a.species})`));
    console.log(`PublicAnimal collection: ${publicAnimals.length} matching docs`);
    publicAnimals.forEach(a => console.log(`  ${a.id_public} "${a.name}" (${a.species})`));

    if (APPLY) {
        const animalResult = await Animal.deleteMany({ id_public: { $in: IDS_TO_DELETE } });
        const publicResult = await PublicAnimal.deleteMany({ id_public: { $in: IDS_TO_DELETE } });
        console.log(`\nDeleted ${animalResult.deletedCount} Animal docs, ${publicResult.deletedCount} PublicAnimal docs.`);
    } else {
        console.log('\nDry run only — pass --apply to delete.');
    }

    await mongoose.disconnect();
}

main().catch(err => { console.error(err); process.exit(1); });
