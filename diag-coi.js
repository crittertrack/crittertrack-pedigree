/**
 * Diagnostic script: trace COI calculation for a specific pairing.
 * Usage: node diag-coi.js <sireId> <damId> [generations]
 * Example: node diag-coi.js CTC804 CTC806 20
 */
require('dotenv').config();
const mongoose = require('mongoose');
const { buildPedigreeDAG, computePathSums, explainPairingInbreeding } = require('./utils/inbreeding');

const SIRE_ID = process.argv[2] || 'CTC804';
const DAM_ID  = process.argv[3] || 'CTC806';
const GENS    = parseInt(process.argv[4]) || 20;

async function run() {
    const uri = process.env.MONGODB_URI;
    if (!uri) { console.error('MONGODB_URI not set'); process.exit(1); }

    await mongoose.connect(uri);
    console.log('Connected to MongoDB\n');

    const { Animal, PublicAnimal } = require('./database/models');

    // Per-request cache — same as the route handler
    const cache = new Map();
    let dbHits = 0;
    let cacheHits = 0;

    const fetchAnimal = async (id) => {
        if (cache.has(id)) { cacheHits++; return cache.get(id); }
        dbHits++;
        let a = await Animal.findOne({ id_public: id }).lean();
        if (!a) a = await PublicAnimal.findOne({ id_public: id }).lean();
        cache.set(id, a);
        if (!a) console.warn(`  [MISSING] Animal not found: ${id}`);
        return a;
    };

    // Check the animals exist
    const sire = await fetchAnimal(SIRE_ID);
    const dam  = await fetchAnimal(DAM_ID);
    console.log(`Sire: ${sire ? `${sire.name} (${SIRE_ID}) — sire=${sire.sireId_public||sire.fatherId_public||'none'}, dam=${sire.damId_public||sire.motherId_public||'none'}` : `NOT FOUND (${SIRE_ID})`}`);
    console.log(`Dam:  ${dam  ? `${dam.name}  (${DAM_ID})  — sire=${dam.sireId_public||dam.fatherId_public||'none'}, dam=${dam.damId_public||dam.motherId_public||'none'}`  : `NOT FOUND (${DAM_ID})`}`);
    console.log();

    // Build pedigrees and time each step
    console.log(`Building sire DAG (${GENS} generations)...`);
    const t0 = Date.now();
    const sireDag = await buildPedigreeDAG(SIRE_ID, fetchAnimal, GENS);
    const t1 = Date.now();
    console.log(`  Done in ${t1-t0}ms  (${sireDag.size} unique animals, DB hits: ${dbHits}, cache hits: ${cacheHits})`);

    console.log(`Building dam DAG (${GENS} generations)...`);
    const damDag = await buildPedigreeDAG(DAM_ID, fetchAnimal, GENS);
    const t2 = Date.now();
    console.log(`  Done in ${t2-t1}ms  (${damDag.size} unique animals, DB hits total: ${dbHits}, cache hits: ${cacheHits})`);

    const sireDP = computePathSums(SIRE_ID, sireDag);
    const damDP  = computePathSums(DAM_ID,  damDag);
    const common = [...sireDP.keys()].filter(id => damDP.has(id));
    console.log(`\nCommon ancestors: ${common.length}`);

    // Count paths from each parent to each common ancestor
    const { explainPairingInbreeding } = require('./utils/inbreeding');
    console.log('\nRunning full explain (same logic as route)...');
    const t3 = Date.now();
    try {
        const result = await explainPairingInbreeding(SIRE_ID, DAM_ID, fetchAnimal, GENS);
        const t4 = Date.now();
        console.log(`  Completed in ${t4-t3}ms`);
        console.log(`  Total COI: ${result.total}%`);
        console.log(`  Common ancestors contributing: ${result.breakdown.length}`);
        result.breakdown.slice(0, 10).forEach(b => {
            console.log(`    - ${b.ancestorName} (${b.ancestorId}): ${b.contribution_pct}%`);
        });
    } catch (err) {
        const t4 = Date.now();
        console.error(`  FAILED after ${t4-t3}ms:`, err.message);
    }

    console.log(`\nTotal DB queries: ${dbHits}, cache hits: ${cacheHits}`);
    await mongoose.disconnect();
}

run().catch(err => { console.error(err); process.exit(1); });
