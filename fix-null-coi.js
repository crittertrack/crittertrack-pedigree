require('dotenv').config();
const mongoose = require('mongoose');

// Memoized pedigree builder — prevents exponential re-traversal of shared ancestors.
// Each animal ID is built once then reused across all branches that reference it.
async function buildMemoizedPedigree(animalId, fetchAnimal, depth, cache = new Map()) {
    if (!animalId || depth === 0) return null;
    if (cache.has(animalId)) return cache.get(animalId);

    // Insert a placeholder to break cycles before the async fetch resolves
    cache.set(animalId, null);

    const animal = await fetchAnimal(animalId);
    if (!animal) return null;

    const sireId = animal.sireId_public || animal.fatherId_public;
    const damId = animal.damId_public || animal.motherId_public;

    const node = {
        id: animalId,
        name: animal.name,
        sire: sireId ? await buildMemoizedPedigree(sireId, fetchAnimal, depth - 1, cache) : null,
        dam: damId ? await buildMemoizedPedigree(damId, fetchAnimal, depth - 1, cache) : null,
        inbreeding: 0,
    };

    cache.set(animalId, node);
    return node;
}

// Wright's path method using the memoized pedigree
function getAllAncestors(node, ancestors = []) {
    if (!node) return ancestors;
    ancestors.push(node);
    getAllAncestors(node.sire, ancestors);
    getAllAncestors(node.dam, ancestors);
    return ancestors;
}

function findPathsToAncestor(node, targetId, currentPath) {
    if (!node) return [];
    const path = [...currentPath, node.id];
    if (node.id === targetId) return [path];
    return [
        ...findPathsToAncestor(node.sire, targetId, path),
        ...findPathsToAncestor(node.dam, targetId, path),
    ];
}

async function calcCOI(animalId, fetchAnimal, generations = 8) {
    if (!animalId) return 0;
    const cache = new Map();
    const pedigree = await buildMemoizedPedigree(animalId, fetchAnimal, generations, cache);
    if (!pedigree || !pedigree.sire || !pedigree.dam) return 0;

    const sireAncs = getAllAncestors(pedigree.sire);
    const damAncs = getAllAncestors(pedigree.dam);

    const seenSire = new Set();
    const uniqueSire = [];
    for (const a of sireAncs) {
        if (!seenSire.has(a.id)) { seenSire.add(a.id); uniqueSire.push(a); }
    }
    const damIds = new Set(damAncs.map(a => a.id));
    const common = uniqueSire.filter(a => damIds.has(a.id));
    if (common.length === 0) return 0;

    let coi = 0;
    for (const ancestor of common) {
        const sp = findPathsToAncestor(pedigree.sire, ancestor.id, []);
        const dp = findPathsToAncestor(pedigree.dam, ancestor.id, []);
        for (const s of sp) {
            for (const d of dp) {
                coi += Math.pow(0.5, s.length + d.length - 1) * (1 + (ancestor.inbreeding || 0));
            }
        }
    }
    return parseFloat((coi * 100).toFixed(2));
}

mongoose.connect(process.env.MONGODB_URI || process.env.DB_URI).then(async () => {
    const { Animal, PublicAnimal } = require('./database/models');

    const fetchCache = new Map();
    const fetchAnimal = async (id) => {
        if (fetchCache.has(id)) return fetchCache.get(id);
        let a = await Animal.findOne({ id_public: id }).lean();
        if (!a) a = await PublicAnimal.findOne({ id_public: id }).lean();
        fetchCache.set(id, a);
        return a;
    };

    // CTC953 first — it's the sire of CTC311
    const ids = ['CTC953', 'CTC276', 'CTC281', 'CTC301', 'CTC304', 'CTC311', 'CTC400', 'CTC527', 'CTC1860'];

    for (const id of ids) {
        try {
            const coeff = await calcCOI(id, fetchAnimal, 8);
            await Animal.updateOne({ id_public: id }, { inbreedingCoefficient: coeff });
            await PublicAnimal.updateOne({ id_public: id }, { inbreedingCoefficient: coeff });
            console.log(`${id} -> ${coeff}`);
        } catch (e) {
            console.log(`${id} ERROR: ${e.message}`);
        }
    }

    const remaining = await Animal.countDocuments({ inbreedingCoefficient: null });
    console.log(`\nDone. Remaining null: ${remaining}`);
    await mongoose.disconnect();
});
