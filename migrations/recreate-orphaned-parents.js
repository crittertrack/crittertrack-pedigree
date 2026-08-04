// Recreates animal records for dangling sireId_public/damId_public references found by
// find-orphaned-parent-refs.js, restoring the pedigree link. New records are owned by
// CTU1, archived (hidden from main lists but still resolvable for pedigree), gender is
// inferred from which field referenced them, species is copied from a referencing child.
// Run with: node migrations/recreate-orphaned-parents.js
require('dotenv').config();
const mongoose = require('mongoose');
const { Animal, PublicAnimal, User } = require('../database/models');

async function main() {
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error('MONGODB_URI not found in environment variables.');
    await mongoose.connect(uri);
    console.log('Connected to MongoDB.');

    const owner = await User.findOne({ id_public: 'CTU1' }).select('_id id_public').lean();
    if (!owner) throw new Error('User CTU1 not found.');

    const animals = await Animal.find({
        $or: [{ sireId_public: { $ne: null } }, { damId_public: { $ne: null } }]
    }).select('id_public species sireId_public damId_public').lean();

    const referencedIds = new Set();
    animals.forEach(a => {
        if (a.sireId_public) referencedIds.add(a.sireId_public);
        if (a.damId_public) referencedIds.add(a.damId_public);
    });

    const [existingAnimals, existingPublic] = await Promise.all([
        Animal.find({ id_public: { $in: [...referencedIds] } }).select('id_public').lean(),
        PublicAnimal.find({ id_public: { $in: [...referencedIds] } }).select('id_public').lean(),
    ]);
    const existingSet = new Set([...existingAnimals, ...existingPublic].map(e => e.id_public));

    // Build one entry per missing parent ID: gender from the field it was referenced as, species from a referencing child.
    const toRecreate = new Map();
    animals.forEach(a => {
        if (a.sireId_public && !existingSet.has(a.sireId_public) && !toRecreate.has(a.sireId_public)) {
            toRecreate.set(a.sireId_public, { id_public: a.sireId_public, gender: 'Male', species: a.species });
        }
        if (a.damId_public && !existingSet.has(a.damId_public) && !toRecreate.has(a.damId_public)) {
            toRecreate.set(a.damId_public, { id_public: a.damId_public, gender: 'Female', species: a.species });
        }
    });

    console.log(`Recreating ${toRecreate.size} missing parent animal(s) under ${owner.id_public}...\n`);

    for (const parent of toRecreate.values()) {
        await Animal.create({
            creatorId: owner._id,
            creatorId_public: owner.id_public,
            id_public: parent.id_public,
            species: parent.species,
            name: 'Unknown (Recreated)',
            gender: parent.gender,
            archived: true,
            notes: `Auto-recreated on ${new Date().toISOString().split('T')[0]} to restore a pedigree link — original record was deleted. Edit details as needed.`,
        });
        console.log(`  Created ${parent.id_public} (${parent.gender}, ${parent.species})`);
    }

    await mongoose.disconnect();
    console.log('\nDone.');
}

main().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
