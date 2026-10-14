/**
 * One-off probe: dump the retired free-text "manualPedigree" field for a given list of animal
 * IDs, so we can see whether a name like "Plume d'argent" appears there. Read-only.
 *
 * NOTE (per debug/find_ancestor_in_owned.js): these slots are display-only legacy data - they
 * never fed the parent cards or the COI calculation, so the app does not treat them as real
 * ancestry edges. This probe is only for human curiosity/completeness.
 *
 * Usage:
 *   node debug/probe_manual_pedigree_for_ids.js
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { MongoClient } = require('mongodb');

const IDS = ['CTC6917', 'CTC6908', 'CTC6633', 'CTC6902', 'CTC2686', 'CTC6277', 'CTC2619'];

async function main() {
    const uri = process.env.MONGODB_URI;
    if (!uri) { console.error('MONGODB_URI not set'); process.exit(1); }

    const client = new MongoClient(uri);
    await client.connect();
    const db = client.db(process.env.MONGODB_DB_NAME || undefined);
    const animals = db.collection('animals');

    for (const id of IDS) {
        const doc = await animals.findOne({ id_public: id }, { projection: { id_public: 1, name: 1, manualPedigree: 1 } });
        if (!doc) { console.log(`[${id}] -- not found`); continue; }
        const mp = doc.manualPedigree;
        const has = mp ? JSON.stringify(mp).toLowerCase().includes('plume') : false;
        console.log(`\n[${id}] ${doc.name}  manualPedigree present: ${!!mp}${has ? '  <-- MENTIONS "PLUME"' : ''}`);
        if (mp) console.log(JSON.stringify(mp, null, 2));
    }

    await client.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
