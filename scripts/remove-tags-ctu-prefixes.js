/**
 * remove-tags-ctu-prefixes.js
 * Removes all tags from animals owned by CTU1, CTU2, and CTU8.
 * Run with: node scripts/remove-tags-ctu-prefixes.js
 * Set DRY_RUN=false to actually apply changes.
 */
const mongoose = require('mongoose');
require('dotenv').config();
const { Animal } = require('../database/models');

const DRY_RUN = false;
const TARGET_OWNERS = ['CTU1', 'CTU2', 'CTU8'];

(async () => {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    for (const owner of TARGET_OWNERS) {
        // Count animals with at least one tag
        const withTags = await Animal.countDocuments({
            ownerId_public: owner,
            tags: { $exists: true, $not: { $size: 0 } }
        });

        console.log(`\n[${owner}] Animals with tags: ${withTags}`);

        if (withTags === 0) {
            console.log(`[${owner}] Nothing to do.`);
            continue;
        }

        if (DRY_RUN) {
            // Sample a few to confirm
            const samples = await Animal.find(
                { ownerId_public: owner, tags: { $exists: true, $not: { $size: 0 } } },
                { id_public: 1, name: 1, tags: 1 }
            ).limit(5).lean();
            console.log(`[${owner}] Sample animals with tags:`);
            samples.forEach(a => console.log(`  ${a.id_public} "${a.name}" tags: ${JSON.stringify(a.tags)}`));
            console.log(`[${owner}] DRY RUN - no changes made`);
        } else {
            const result = await Animal.updateMany(
                { ownerId_public: owner, tags: { $exists: true, $not: { $size: 0 } } },
                { $set: { tags: [] } }
            );
            console.log(`[${owner}] Cleared tags on ${result.modifiedCount} animals`);
        }
    }

    console.log('\nDone.');
    await mongoose.disconnect();
})();
