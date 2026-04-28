/**
 * analyse-ctu8-collections.js
 *
 * For CTU8:
 * - Finds all owned (non-archived) animals
 * - Checks which ones are assigned to a collection
 * - Groups unassigned animals by prefix + suffix
 * - Reports how many animals per prefix/suffix group (to spot collection candidates)
 */

const mongoose = require('mongoose');
require('dotenv').config();
const { Animal, User } = require('../database/models');

const OWNER = 'CTU8';

(async () => {
    await mongoose.connect(process.env.MONGODB_URI);

    // 1. Load the user's animalCollections map
    const user = await User.findOne({ id_public: OWNER }).select('animalCollections').lean();
    const animalMap = user?.animalCollections?.animalMap || {};
    const collections = user?.animalCollections?.collections || [];

    const assignedIds = new Set(
        Object.entries(animalMap)
            .filter(([, colIds]) => Array.isArray(colIds) && colIds.length > 0)
            .map(([id_public]) => id_public)
    );

    console.log(`\n=== CTU8 Collection Summary ===`);
    console.log(`Defined collections : ${collections.length}`);
    collections.forEach(c => {
        const count = Object.values(animalMap).filter(ids => Array.isArray(ids) && ids.includes(c.id)).length;
        console.log(`  • "${c.name}" — ${count} animals`);
    });

    // 2. Load CTU8's internal _id (ownerId is the backend ObjectId, not id_public)
    const ctu8User = await User.findOne({ id_public: OWNER }).select('_id').lean();
    if (!ctu8User) { console.error('CTU8 user not found'); process.exit(1); }
    const ownerInternalId = ctu8User._id;

    // Match what the UI does: ownerId = internal _id, not archived, not a stub,
    // excluding view-only (animals owned by someone else but shared to CTU8)
    const animals = await Animal.find({
        ownerId: ownerInternalId,
        archived: { $ne: true },
        isStub: { $ne: true },
    }).select('id_public name prefix suffix status soldStatus').sort({ birthDate: -1 }).lean();

    const total = animals.length;
    const assigned = animals.filter(a => assignedIds.has(a.id_public));
    const unassigned = animals.filter(a => !assignedIds.has(a.id_public));

    console.log(`\nTotal owned (non-archived) : ${total}`);
    console.log(`Assigned to a collection   : ${assigned.length}`);
    console.log(`NOT in any collection      : ${unassigned.length}`);

    // 3. Group unassigned by prefix/suffix combo
    const groups = {};
    for (const a of unassigned) {
        const prefix = (a.prefix || '').trim();
        const suffix = (a.suffix || '').trim();
        const key = prefix || suffix
            ? `prefix="${prefix || '—'}"  suffix="${suffix || '—'}"`
            : '(no prefix or suffix)';
        if (!groups[key]) groups[key] = [];
        groups[key].push(a);
    }

    // Sort by count desc
    const sorted = Object.entries(groups).sort((a, b) => b[1].length - a[1].length);

    console.log(`\n=== Unassigned animals grouped by prefix/suffix (${unassigned.length} total) ===`);
    console.log(`${'Group'.padEnd(58)} | Count | Animals`);
    console.log(`${'-'.repeat(58)}-+-------+--------`);
    for (const [key, list] of sorted) {
        const names = list.map(a => `${a.name}`).join(', ');
        const truncated = names.length > 80 ? names.slice(0, 77) + '...' : names;
        console.log(`${key.padEnd(58)} | ${String(list.length).padStart(5) } | ${truncated}`);
    }

    // 4. Also show prefix/suffix breakdown for ALL animals (for full picture)
    const allGroups = {};
    for (const a of animals) {
        const prefix = (a.prefix || '').trim();
        const suffix = (a.suffix || '').trim();
        const key = prefix || suffix
            ? `prefix="${prefix || '—'}"  suffix="${suffix || '—'}"`
            : '(no prefix or suffix)';
        if (!allGroups[key]) allGroups[key] = { total: 0, assigned: 0 };
        allGroups[key].total++;
        if (assignedIds.has(a.id_public)) allGroups[key].assigned++;
    }

    const allSorted = Object.entries(allGroups).sort((a, b) => b[1].total - a[1].total);

    console.log(`\n=== ALL animals grouped by prefix/suffix (assigned vs unassigned) ===`);
    console.log(`${'Group'.padEnd(58)} | Total | In col | Unassigned`);
    console.log(`${'-'.repeat(58)}-+-------+--------+-----------`);
    for (const [key, counts] of allSorted) {
        const unass = counts.total - counts.assigned;
        console.log(`${key.padEnd(58)} | ${String(counts.total).padStart(5)} | ${String(counts.assigned).padStart(6)} | ${String(unass).padStart(10)}`);
    }

    await mongoose.disconnect();
})();
