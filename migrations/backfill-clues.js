// Gathers identifying clues for the 5 recreated parent placeholders: denormalized name
// info from any Litter records that reference them, plus their offspring's data (which
// may hint at species/line/notes), to help manually backfill real details.
// Run with: node migrations/backfill-clues.js
require('dotenv').config();
const mongoose = require('mongoose');
const { Animal, Litter } = require('../database/models');

const RECREATED_IDS = ['CTC1622', 'CTC1722', 'CTC5223', 'CTC4620', 'CTC4616'];

async function main() {
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error('MONGODB_URI not found in environment variables.');
    await mongoose.connect(uri);
    console.log('Connected to MongoDB.');

    for (const id of RECREATED_IDS) {
        console.log(`\n=== ${id} ===`);

        const litters = await Litter.find({ $or: [{ sireId_public: id }, { damId_public: id }] })
            .select('litter_id_public breedingPairCodeName sireId_public sirePrefixName damId_public damPrefixName birthDate matingDate notes')
            .lean();
        if (litters.length) {
            console.log('  Litter record(s) referencing this ID:');
            litters.forEach(l => {
                const role = l.sireId_public === id ? 'sire' : 'dam';
                const name = role === 'sire' ? l.sirePrefixName : l.damPrefixName;
                console.log(`    Litter ${l.litter_id_public} "${l.breedingPairCodeName || ''}" — role=${role}, denormalized name="${name || '(none)'}", birthDate=${l.birthDate || 'n/a'}, matingDate=${l.matingDate || 'n/a'}`);
            });
        } else {
            console.log('  No Litter records reference this ID.');
        }

        const offspring = await Animal.find({ $or: [{ sireId_public: id }, { damId_public: id }] })
            .select('id_public name prefix suffix species birthDate breederAssignedId notes')
            .lean();
        if (offspring.length) {
            console.log('  Offspring:');
            offspring.forEach(o => {
                console.log(`    ${o.id_public} — ${[o.prefix, o.name, o.suffix].filter(Boolean).join(' ')} (${o.species}, born ${o.birthDate ? new Date(o.birthDate).toISOString().split('T')[0] : 'n/a'}, breederAssignedId=${o.breederAssignedId || 'n/a'})`);
            });
        }
    }

    await mongoose.disconnect();
}

main().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
