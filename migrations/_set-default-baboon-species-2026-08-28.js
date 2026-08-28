// Migration: mark the 5 custom baboon-spider/iguana species as default, and fix kigoma baboon's category
// Dry-run by default; pass --apply to write changes.
require('dotenv').config();
const mongoose = require('mongoose');
const { Species } = require('../database/models');

const UPDATES = [
    { name: 'Bronze baboon', category: 'Invertebrate' },
    { name: 'Green iguana', category: 'Reptile' },
    { name: 'Rear-Horned Baboon', category: 'Invertebrate' },
    { name: 'kigoma baboon', category: 'Invertebrate' },
    { name: 'pumpkin patch', category: 'Invertebrate' },
];

const APPLY = process.argv.includes('--apply');

async function main() {
    await mongoose.connect(process.env.MONGODB_URI);

    for (const { name, category } of UPDATES) {
        const doc = await Species.findOne({ name });
        if (!doc) {
            console.log(`SKIP (not found): ${name}`);
            continue;
        }

        const changes = {};
        if (doc.isDefault !== true) changes.isDefault = true;
        if (doc.category !== category) changes.category = category;

        if (Object.keys(changes).length === 0) {
            console.log(`NO CHANGE: ${name} (already isDefault=true, category=${category})`);
            continue;
        }

        console.log(`${APPLY ? 'APPLYING' : 'WOULD UPDATE'}: ${name} ->`, changes,
            `(was isDefault=${doc.isDefault}, category=${doc.category})`);

        if (APPLY) {
            await Species.updateOne({ _id: doc._id }, { $set: changes });
        }
    }

    await mongoose.disconnect();
}

main().catch(err => { console.error(err); process.exit(1); });
