/**
 * One-off probe: for a given list of animal IDs, report whether each is itself a descendant of
 * CTC922 and how many generations below her it sits. Read-only. Same backwards-BFS technique
 * as find_ancestor_in_owned.js / check_ancestor_list.js.
 *
 * Usage:
 *   node debug/probe_ids_descendance_from_CTC922.js
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { MongoClient } = require('mongodb');

const TARGET = 'CTC922';

// Ancestor animals referenced by the NO animals' canonical links and/or manualPedigree slots.
const IDS = [
    ['CTC1051', 'DM Kristoff (sire of Kristoffer/Caspian)'],
    ['CTC1093', 'DM Becca (dam of Caspian)'],
    ['CTC6911', 'DM Koetje (sire of Ditzy)'],
    ['CTC6909', 'CDR Dotty (dam of Ditzy)'],
    ['CTC1103', "SLM's Dumbo"],
    ['CTC703', "SLM's Onyx"],
    ['CTC704', "SLM's Oozara"],
    ['CTC1102', 'DM Perdita 2.0'],
    ['CTC1043', 'Denahi (sire of Pootsie)'],
    ['CTC1076', 'Ariel (dam of Pootsie)'],
    ['CTC305', 'MM Gameboy (sire of Denahi, per manual pedigree)'],
    ['CTC300', 'M&M Leila (dam of Denahi, per manual pedigree)'],
    ['CTC303', 'MM Nero'],
    ['CTC304', 'TnS Erina (granddam of Pootsie, per manual pedigree)'],
    ['CTC294', 'MM Kadeem'],
    ['CTC295', 'M&M Praline'],
];

async function main() {
    const uri = process.env.MONGODB_URI;
    if (!uri) { console.error('MONGODB_URI not set'); process.exit(1); }

    const client = new MongoClient(uri);
    await client.connect();
    const db = client.db(process.env.MONGODB_DB_NAME || undefined);
    const animals = db.collection('animals');

    const target = await animals.findOne({ id_public: TARGET });
    if (!target) { console.error(`No animal ${TARGET}`); await client.close(); process.exit(1); }

    // parent -> children index over the whole collection (canonical links only).
    const childrenOf = new Map();
    const names = new Map();
    for await (const doc of animals.find({}, { projection: { id_public: 1, name: 1, prefix: 1, sireId_public: 1, damId_public: 1 } })) {
        names.set(doc.id_public, (doc.prefix ? doc.prefix + ' ' : '') + (doc.name || '?'));
        for (const pid of [doc.sireId_public, doc.damId_public]) {
            if (!pid) continue;
            if (!childrenOf.has(pid)) childrenOf.set(pid, []);
            childrenOf.get(pid).push(doc.id_public);
        }
    }

    // BFS down from TARGET -> gen map.
    const gen = new Map([[TARGET, 0]]);
    let frontier = [TARGET];
    while (frontier.length) {
        const next = [];
        for (const id of frontier) {
            for (const kid of childrenOf.get(id) || []) {
                if (gen.has(kid)) continue;
                gen.set(kid, gen.get(id) + 1);
                next.push(kid);
            }
        }
        frontier = next;
    }

    console.log(`Descendants of ${TARGET} "${target.name}" in DB: ${gen.size - 1}\n`);
    for (const [id, note] of IDS) {
        const known = names.has(id);
        const depth = gen.has(id) ? gen.get(id) : null;
        const status = !known
            ? 'NOT FOUND in database'
            : depth === null
                ? 'not a descendant (via recorded links)'
                : `DESCENDANT, ${depth} generations below ${TARGET}`;
        console.log(`${id}  ${(names.get(id) || '(missing)').padEnd(22)}  ${status}`);
        if (note) console.log(`      ${note}`);
    }

    await client.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
