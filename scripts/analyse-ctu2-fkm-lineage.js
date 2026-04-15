/**
 * analyse-ctu2-fkm-lineage.js
 *
 * Find all currently OWNED animals on CTU2 that have any FKM-prefixed animal
 * anywhere in their pedigree/lineage (sire/dam chain, recursively).
 *
 * Uses a bulk BFS approach: loads all animals into a Map once, then traverses
 * in-memory — far faster than individual DB calls per ancestor.
 */

const mongoose = require('mongoose');
require('dotenv').config();
const { Animal } = require('../database/models');

const MAX_DEPTH = 12;

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);

  // Load ALL animals into memory (id_public → {prefix, name, suffix, sireId_public, damId_public})
  console.log('Loading all animals...');
  const allAnimals = await Animal.find({}).select('id_public name prefix suffix sireId_public damId_public').lean();
  const animalMap = new Map(allAnimals.map(a => [a.id_public, a]));
  console.log(`Loaded ${animalMap.size} animals\n`);

  // BFS in-memory
  function getAncestors(startId) {
    const visited = new Set();
    const queue = [startId];
    let depth = 0;
    const levelSizes = [1];
    let levelIdx = 0;
    let inLevel = 1;

    while (queue.length > 0 && depth <= MAX_DEPTH) {
      const id = queue.shift();
      inLevel--;
      if (!id || visited.has(id)) {
        if (inLevel === 0) { depth++; inLevel = levelSizes[levelIdx++] || 0; }
        continue;
      }
      visited.add(id);
      const a = animalMap.get(id);
      if (a) {
        if (a.sireId_public) queue.push(a.sireId_public);
        if (a.damId_public) queue.push(a.damId_public);
      }
      if (inLevel === 0) { depth++; inLevel = queue.length; }
    }
    return visited;
  }

  // Get all currently owned animals on CTU2
  const ctu2Animals = allAnimals.filter(a =>
    a.ownerId_public === 'CTU2' &&
    !a.archived &&
    !a.isStub
  );
  // Re-fetch with isOwned filter (not in the lean select above)
  const ctu2Owned = await Animal.find({
    ownerId_public: 'CTU2',
    isOwned: true,
    archived: { $ne: true },
    isStub: { $ne: true },
  }).select('id_public name prefix suffix sireId_public damId_public').lean();

  console.log(`CTU2 owned animals: ${ctu2Owned.length}\n`);

  const fkmRegex = /^FKM$/i;
  const results = [];

  for (const animal of ctu2Owned) {
    const ancestors = getAncestors(animal.id_public);
    ancestors.delete(animal.id_public); // exclude self

    const fkmAncestors = [];
    for (const id of ancestors) {
      const a = animalMap.get(id);
      if (a && fkmRegex.test(a.prefix)) fkmAncestors.push(a);
    }

    if (fkmAncestors.length > 0) {
      results.push({ animal, fkmAncestors });
    }
  }

  console.log(`=== CTU2 owned animals with FKM ancestors: ${results.length} ===\n`);
  for (const { animal, fkmAncestors } of results) {
    const fullName = [animal.prefix, animal.name, animal.suffix].filter(Boolean).join(' ');
    console.log(`  ${animal.id_public}  "${fullName}"`);
    for (const anc of fkmAncestors) {
      console.log(`    └ FKM: ${anc.id_public}  "${[anc.prefix, anc.name].filter(Boolean).join(' ')}"`);
    }
  }

  await mongoose.disconnect();
})();
