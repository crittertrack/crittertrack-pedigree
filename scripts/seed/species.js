'use strict';
/**
 * species: the 73 built-in defaults (from git history migrate-species.js) +
 * every other species name that restored animals use (added as non-default, category guessed 'Other'
 * unless it matches a known default's category by keyword).
 */
const fs = require('fs');
const path = require('path');

module.exports = async (L, ctx) => {
    const { Species } = L.models;
    const defaults = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data-species-defaults.json'), 'utf8'));
    const docs = defaults.map(s => ({ name: s.name, latinName: s.latinName, category: s.category, isDefault: true, userId: null, createdBy_public: null, createdAt: new Date(), updatedAt: new Date(), __v: 0 }));

    const known = new Set(defaults.map(d => d.name.toLowerCase()));
    const used = {};
    ctx.animals.forEach(a => { const n = String(a.species || '').trim(); if (n) used[n] = (used[n] || 0) + 1; });
    const guess = (n) => /gecko|snake|python|dragon|iguana|tortoise|skink|chameleon|kingsnake/i.test(n) ? 'Reptile'
        : /tarantula|isopod|baboon|birdeater|blood ?leg|ornamental|pumpkin|zebra|scorpion|mantis/i.test(n) ? 'Invertebrate'
        : /budgie|cockatiel|parrot|finch|canary|lovebird/i.test(n) ? 'Bird'
        : /mouse|rat|hamster|gerbil|guinea|rabbit|ferret|cat|dog|hedgehog/i.test(n) ? 'Mammal' : 'Other';
    const extra = [];
    for (const [n, c] of Object.entries(used)) {
        if (known.has(n.toLowerCase())) continue;
        extra.push(n);
        docs.push({ name: n, latinName: null, category: guess(n), isDefault: false, userId: null, createdBy_public: null, createdAt: new Date(), updatedAt: new Date(), __v: 0 });
    }
    L.log(`  defaults: ${defaults.length}; extra names used by animals (not in defaults): ${extra.length}`);
    L.log('  extra: ' + extra.join(', '));
    // case-insensitive unique check on name
    await L.insertMissing(Species, docs, (d) => ({ name: { $regex: '^' + d.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', $options: 'i' } }), 'species');
};
