// Read-only diagnostic: counts how many Animal records exist per species name, so we
// can see which species (beyond just being selectable in the picker) are actually in
// active use on the live site. Cross-references against the Species collection to also
// flag custom/user-added species that aren't in the frontend's static category map.
// Run with: node migrations/audit-species-usage-2026-08-05.js
require('dotenv').config();
const mongoose = require('mongoose');
const { Animal, Species } = require('../database/models');

async function main() {
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error('MONGODB_URI not found in environment variables.');
    await mongoose.connect(uri);
    console.log('Connected to MongoDB.\n');

    const [counts, allSpecies] = await Promise.all([
        Animal.aggregate([
            { $group: {
                _id: '$species',
                total: { $sum: 1 },
                active: { $sum: { $cond: [{ $eq: ['$archived', true] }, 0, 1] } },
                archived: { $sum: { $cond: [{ $eq: ['$archived', true] }, 1, 0] } },
            } },
            { $sort: { total: -1 } },
        ]),
        Species.find().select('name category isDefault').lean(),
    ]);

    const speciesMeta = new Map(allSpecies.map(s => [s.name, s]));

    console.log(`Total distinct species values found on Animal records: ${counts.length}`);
    console.log(`Total Species collection entries: ${allSpecies.length}\n`);

    console.log('=== Species usage (by Animal record count, descending) ===');
    counts.forEach(c => {
        const meta = speciesMeta.get(c._id);
        const category = meta ? meta.category : '(no Species doc)';
        const custom = meta ? (meta.isDefault ? 'default' : 'custom') : 'unknown';
        console.log(`${String(c.total).padStart(5)}  (active ${c.active}, archived ${c.archived})  ${c._id}  [${category}, ${custom}]`);
    });

    const usedNames = new Set(counts.map(c => c._id));
    const unusedDefaults = allSpecies.filter(s => s.isDefault && !usedNames.has(s.name));
    console.log('\n=== Default/catalogued species with ZERO Animal records ===');
    if (unusedDefaults.length === 0) console.log('(none - every default species has at least 1 animal)');
    unusedDefaults.forEach(s => console.log(`${s.name} [${s.category}]`));

    await mongoose.disconnect();
}

main().catch(err => { console.error(err); process.exit(1); });
