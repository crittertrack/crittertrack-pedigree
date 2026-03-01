/**
 * One-time migration: recalculate and cache inbreedingCoefficient for ALL animals.
 *
 * Run with:  node recalculate-all-coi.js
 * Optional:  node recalculate-all-coi.js --dry-run   (print without saving)
 *
 * Strategy: process animals in topological order (ancestors before descendants)
 * so that each animal's own cached COI is correct before its children use it.
 */

require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');

const DRY_RUN = process.argv.includes('--dry-run');
const LOG_FILE = process.argv.find(a => a.startsWith('--log='))?.split('=')[1] || null;

// Write to both stdout and optional log file, always flushed
function log(msg) {
    process.stdout.write(msg + '\n');
    if (LOG_FILE) fs.appendFileSync(LOG_FILE, msg + '\n');
}

async function main() {
    await mongoose.connect(process.env.MONGODB_URI || process.env.DB_URI);
    log('Connected to MongoDB');

    const { Animal, PublicAnimal } = require('./database/models');
    const { calculateInbreedingCoefficient } = require('./utils/inbreeding');

    const fetchAnimal = async (id) => {
        let a = await Animal.findOne({ id_public: id }).lean();
        if (!a) a = await PublicAnimal.findOne({ id_public: id }).lean();
        return a;
    };

    // Load all animals (only the fields we need for topo sort + recalc)
    const all = await Animal.find({}).lean().select('id_public sireId_public damId_public fatherId_public motherId_public inbreedingCoefficient');
    log(`Found ${all.length} animals`);

    // Build adjacency: child -> parents, and in-degree map for topological sort
    const byId = new Map(all.map(a => [a.id_public, a]));
    const childrenOf = new Map(); // parent id_public -> [child id_public]
    const inDegree = new Map();

    for (const a of all) {
        inDegree.set(a.id_public, 0);
    }
    for (const a of all) {
        const sire = a.sireId_public || a.fatherId_public;
        const dam  = a.damId_public  || a.motherId_public;
        for (const parentId of [sire, dam]) {
            if (parentId && byId.has(parentId)) {
                if (!childrenOf.has(parentId)) childrenOf.set(parentId, []);
                childrenOf.get(parentId).push(a.id_public);
                inDegree.set(a.id_public, (inDegree.get(a.id_public) || 0) + 1);
            }
        }
    }

    // Kahn's algorithm â€” roots first, then children
    const queue = [];
    for (const [id, deg] of inDegree) {
        if (deg === 0) queue.push(id);
    }

    let processed = 0, updated = 0, errors = 0;
    const order = [];

    while (queue.length > 0) {
        const id = queue.shift();
        order.push(id);
        for (const childId of (childrenOf.get(id) || [])) {
            const newDeg = (inDegree.get(childId) || 0) - 1;
            inDegree.set(childId, newDeg);
            if (newDeg === 0) queue.push(childId);
        }
    }

    // Any animals not in the sorted order (cycles / external parents) go last
    const inOrder = new Set(order);
    for (const a of all) {
        if (!inOrder.has(a.id_public)) order.push(a.id_public);
    }

    log(`Processing ${order.length} animals in topological orderâ€¦\n`);

    for (const id_public of order) {
        processed++;
        try {
            const coeff = await Promise.race([
                calculateInbreedingCoefficient(id_public, fetchAnimal, 50),
                new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 30000))
            ]);
            const current = byId.get(id_public)?.inbreedingCoefficient;
            const changed = current !== coeff;

            if (DRY_RUN) {
                if (changed) log(`[DRY] ${id_public}: ${current ?? 'null'} â†’ ${coeff}`);
            } else {
                await Animal.updateOne({ id_public }, { inbreedingCoefficient: coeff });
                await PublicAnimal.updateOne({ id_public }, { inbreedingCoefficient: coeff });
                if (changed) {
                    updated++;
                    log(`[UPDATED] ${id_public}: ${current ?? 'null'} â†’ ${coeff}`);
                }
            }
        } catch (err) {
            errors++;
            console.error(`[ERROR] ${id_public}:`, err.message);
        }

        if (processed % 50 === 0) {
            log(`  â€¦ ${processed}/${order.length} processed, ${updated} updated, ${errors} errors`);
        }
    }

    log(`\nDone. Processed: ${processed}, Updated: ${updated}, Errors: ${errors}`);
    if (DRY_RUN) log('(dry-run â€” no changes saved)');
    await mongoose.disconnect();
}

main().catch(err => {
    console.error('Fatal:', err);
    process.exit(1);
});

