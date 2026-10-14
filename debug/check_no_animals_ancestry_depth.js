/**
 * Probe how deep the RECORDED pedigree (sire/dam links) reaches for a given list of animal IDs.
 * Read-only. Companion to check_ancestor_list.js: it answers "how confident is a NO?" - an
 * animal whose recorded pedigree only reaches back N generations cannot rule out a connection
 * deeper than N. Walks UP from each animal with a visited set (so inbreeding loops are safe);
 * each ancestor is counted once, at its shallowest recorded generation (BFS).
 *
 * Usage:
 *   node debug/check_no_animals_ancestry_depth.js
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { MongoClient } = require('mongodb');

// The seven animals reported as NOT descending from CTC922, plus one YES animal (DM Simba)
// as a control - his depth should come out >= 12, matching the descendant search.
const IDS = [
    ['CTC6917', 'DM Kristoffer'],
    ['CTC6908', 'DM Ditzy'],
    ['CTC6633', 'DM Pootsie'],
    ['CTC6902', 'DM Caspian'],
    ['CTC2686', 'M3 Sora'],
    ['CTC6277', 'CWR Madonna'],
    ['CTC2619', 'CWR Fiero'],
    ['CTC4521', 'DM Simba (YES-control)'],
];

async function main() {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
        console.error('MONGODB_URI not set (expected in crittertrack-pedigree/.env)');
        process.exit(1);
    }

    const client = new MongoClient(uri);
    await client.connect();
    const db = client.db(process.env.MONGODB_DB_NAME || undefined);
    const animals = db.collection('animals');

    // id_public -> { sire, dam } for every animal in the collection.
    const parent = new Map();
    for await (const doc of animals.find({}, { projection: { id_public: 1, sireId_public: 1, damId_public: 1 } })) {
        parent.set(doc.id_public, { sire: doc.sireId_public || null, dam: doc.damId_public || null });
    }

    for (const [id, name] of IDS) {
        if (!parent.has(id)) {
            console.log(`${name.padEnd(24)} [${id}]  -- NOT FOUND in database`);
            continue;
        }
        const visited = new Set([id]);
        let frontier = [id];
        let total = 0;
        let maxGen = 0;
        let gen = 0;
        let perGen = [];
        while (frontier.length) {
            const next = [];
            for (const cur of frontier) {
                const p = parent.get(cur) || {};
                for (const pid of [p.sire, p.dam]) {
                    if (pid && !visited.has(pid)) {
                        visited.add(pid);
                        next.push(pid);
                        total++;
                    }
                }
            }
            if (next.length) {
                gen++;
                maxGen = gen;
                perGen.push(next.length);
            }
            frontier = next;
        }
        const shape = perGen.join(',');
        console.log(`${name.padEnd(24)} [${id}]  ancestors recorded: ${String(total).padStart(4)}  deepest generation: ${String(maxGen).padStart(2)}  (per-gen new: ${shape})`);
    }

    await client.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
