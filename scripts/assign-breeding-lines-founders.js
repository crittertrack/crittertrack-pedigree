/**
 * assign-breeding-lines-founders.js
 * 
 * For CTU2's breeding lines:
 *   Line 0 (Dom Red Legacy)   → CTC46 (MM Sundae Caramel) + all descendants
 *   Line 1 (Brindle Legacy)   → CTC43 (HV Mirabel) + CTC222 (MM Universe) + all descendants
 *   Line 2 (Merle Legacy)     → CTC39 (TnS Black Belle) + all descendants
 * 
 * Descendants are found by recursively walking sireId_public / damId_public
 * across ALL animals in the database (not just CTU2-owned).
 * 
 * Lines are ADDED (union) to any existing assignments on the CTU2 profile.
 * 
 * Run with: node scripts/assign-breeding-lines-founders.js
 */
const mongoose = require('mongoose');
require('dotenv').config();
const { PublicProfile, Animal } = require('../database/models');

const DRY_RUN = false;

const FOUNDERS = [
    { animalId: 'CTC46',  lineId: 0 },  // MM Sundae Caramel → Dom Red (Legacy)
    { animalId: 'CTC43',  lineId: 1 },  // HV Mirabel        → Brindle (Legacy)
    { animalId: 'CTC222', lineId: 1 },  // MM Universe       → Brindle (Legacy)
    { animalId: 'CTC39',  lineId: 2 },  // TnS Black Belle   → Merle (Legacy)
];

// Build a full child map: parentId → [childId, childId, ...]
async function buildChildMap() {
    const animals = await Animal.find(
        {},
        { id_public: 1, sireId_public: 1, damId_public: 1 }
    ).lean();

    const map = {};
    for (const a of animals) {
        if (a.sireId_public) {
            if (!map[a.sireId_public]) map[a.sireId_public] = [];
            map[a.sireId_public].push(a.id_public);
        }
        if (a.damId_public) {
            if (!map[a.damId_public]) map[a.damId_public] = [];
            map[a.damId_public].push(a.id_public);
        }
    }
    return map;
}

// BFS from a founder down through all descendants
function collectDescendants(startId, childMap) {
    const visited = new Set();
    const queue = [startId];
    while (queue.length > 0) {
        const id = queue.shift();
        if (visited.has(id)) continue;
        visited.add(id);
        const children = childMap[id] || [];
        for (const c of children) queue.push(c);
    }
    return visited; // includes startId itself
}

(async () => {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB\n');

    // Verify line defs on CTU2 profile
    const profile = await PublicProfile.findOne({ id_public: 'CTU2' }, { breedingLineDefs: 1, animalBreedingLines: 1 }).lean();
    console.log('CTU2 line defs:');
    profile.breedingLineDefs.filter(l => l.name).forEach(l => console.log(`  [${l.id}] ${l.name}`));

    // Build child map
    console.log('\nBuilding descendant map...');
    const childMap = await buildChildMap();

    // Collect assignments: animalId → Set of lineIds
    const toAssign = {}; // { animalId: Set<lineId> }

    for (const { animalId, lineId } of FOUNDERS) {
        const descendants = collectDescendants(animalId, childMap);
        console.log(`\n[Line ${lineId}] Founder ${animalId} has ${descendants.size} animals (self + descendants):`);
        for (const id of descendants) {
            if (!toAssign[id]) toAssign[id] = new Set();
            toAssign[id].add(lineId);
        }
        // Print a sample
        const sample = [...descendants].slice(0, 10);
        console.log('  Sample:', sample.join(', '), descendants.size > 10 ? `... (+${descendants.size - 10} more)` : '');
    }

    // Merge with existing assignments
    const existing = profile.animalBreedingLines || {};
    const merged = { ...existing };
    let newAssignments = 0;
    let updatedAssignments = 0;

    for (const [animalId, lineSet] of Object.entries(toAssign)) {
        const currentIds = merged[animalId] || [];
        const before = currentIds.length;
        const combined = [...new Set([...currentIds, ...lineSet])];
        merged[animalId] = combined;
        if (before === 0 && combined.length > 0) newAssignments++;
        else if (combined.length > before) updatedAssignments++;
    }

    console.log(`\nTotal animals to update: ${Object.keys(toAssign).length}`);
    console.log(`  New assignments: ${newAssignments}`);
    console.log(`  Added lines to existing: ${updatedAssignments}`);

    if (DRY_RUN) {
        console.log('\nDRY RUN - no changes saved');
    } else {
        await PublicProfile.updateOne(
            { id_public: 'CTU2' },
            { $set: { animalBreedingLines: merged } }
        );
        console.log('\nSaved to CTU2 profile.');
    }

    console.log('\nDone.');
    await mongoose.disconnect();
})();
