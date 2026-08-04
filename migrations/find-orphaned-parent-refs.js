// Read-only diagnostic: finds animals whose sireId_public/damId_public points to an
// id_public that doesn't exist in the Animal collection (e.g. the parent was deleted
// without cleaning up the reference). Run with: node migrations/find-orphaned-parent-refs.js
require('dotenv').config();
const mongoose = require('mongoose');
const { Animal, PublicAnimal } = require('../database/models');

async function main() {
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error('MONGODB_URI not found in environment variables.');
    await mongoose.connect(uri);
    console.log('Connected to MongoDB.');

    const animals = await Animal.find({
        $or: [{ sireId_public: { $ne: null } }, { damId_public: { $ne: null } }]
    }).select('id_public name prefix sireId_public damId_public').lean();

    const referencedIds = new Set();
    animals.forEach(a => {
        if (a.sireId_public) referencedIds.add(a.sireId_public);
        if (a.damId_public) referencedIds.add(a.damId_public);
    });

    // Mirror the /animals/any/:id_public fallback chain: an ID resolves fine if it
    // exists in either the private Animal collection OR the PublicAnimal mirror.
    const [existingAnimals, existingPublic] = await Promise.all([
        Animal.find({ id_public: { $in: [...referencedIds] } }).select('id_public').lean(),
        PublicAnimal.find({ id_public: { $in: [...referencedIds] } }).select('id_public').lean(),
    ]);
    const existingSet = new Set([...existingAnimals, ...existingPublic].map(e => e.id_public));

    const orphans = [];
    animals.forEach(a => {
        if (a.sireId_public && !existingSet.has(a.sireId_public)) {
            orphans.push({ child: a.id_public, childName: a.name, field: 'sireId_public', missingId: a.sireId_public });
        }
        if (a.damId_public && !existingSet.has(a.damId_public)) {
            orphans.push({ child: a.id_public, childName: a.name, field: 'damId_public', missingId: a.damId_public });
        }
    });

    console.log(`Checked ${animals.length} animals with a parent reference.`);
    console.log(`Found ${orphans.length} orphaned parent reference(s):\n`);
    orphans.forEach(o => {
        console.log(`  ${o.child} (${o.childName}) -> ${o.field} = ${o.missingId} (does not exist)`);
    });

    await mongoose.disconnect();
}

main().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
