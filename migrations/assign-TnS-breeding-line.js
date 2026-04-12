/**
 * Assign all TnS-prefix animals (including deceased) on CTU8 to the first
 * breeding line defined on CTU8's profile.
 *
 * Usage:
 *   DRY RUN (default):  node migrations/assign-TnS-breeding-line.js
 *   EXECUTE:            $env:CONFIRM='yes'; node migrations/assign-TnS-breeding-line.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const { Animal, PublicProfile } = require('../database/models');

async function run() {
    const uri = process.env.MONGODB_URI;
    if (!uri) { console.error('MONGODB_URI not set'); process.exit(1); }

    const dryRun = process.env.CONFIRM !== 'yes';

    await mongoose.connect(uri);
    console.log('Connected to MongoDB');
    console.log(dryRun ? '*** DRY RUN ***\n' : '*** LIVE RUN ***\n');

    // ── Get CTU8's profile ──
    const profile = await PublicProfile.findOne({ id_public: 'CTU8' });
    if (!profile) { console.error('CTU8 PublicProfile not found'); process.exit(1); }

    const defs = profile.breedingLineDefs || [];
    console.log(`CTU8 breeding line defs (${defs.length}):`);
    for (const d of defs) {
        console.log(`  id: ${d.id}  name: "${d.name}"  color: ${d.color}`);
    }
    console.log();

    if (defs.length === 0) {
        console.error('No breeding lines defined on CTU8. Create one first.');
        await mongoose.disconnect();
        return;
    }

    const targetLine = defs[0];
    console.log(`Target line: id=${targetLine.id} "${targetLine.name}"\n`);

    // ── Find all TnS animals on CTU8 ──
    const animals = await Animal.find({
        prefix: 'TnS',
        ownerId_public: 'CTU8'
    }).select('id_public name prefix status').sort({ id_public: 1 });

    console.log(`Found ${animals.length} TnS animals on CTU8\n`);

    if (animals.length === 0) {
        console.log('Nothing to assign.');
        await mongoose.disconnect();
        return;
    }

    // ── Build updated animalBreedingLines ──
    const currentMap = profile.animalBreedingLines || {};
    let alreadyAssigned = 0;
    let toAssign = 0;

    for (const a of animals) {
        const existing = currentMap[a.id_public] || [];
        if (existing.includes(targetLine.id)) {
            alreadyAssigned++;
        } else {
            toAssign++;
            if (!dryRun) {
                currentMap[a.id_public] = [...existing, targetLine.id];
            }
        }
        console.log(`  ${a.id_public}  ${a.prefix} ${a.name}  [${a.status || ''}]  ${existing.includes(targetLine.id) ? '(already)' : '→ assign'}`);
    }

    console.log(`\nAlready assigned: ${alreadyAssigned}`);
    console.log(`To assign: ${toAssign}`);

    if (toAssign === 0) {
        console.log('Nothing to do.');
        await mongoose.disconnect();
        return;
    }

    if (dryRun) {
        console.log('\nSet CONFIRM=yes to execute.');
        await mongoose.disconnect();
        return;
    }

    // ── Save ──
    profile.animalBreedingLines = currentMap;
    profile.markModified('animalBreedingLines');
    await profile.save();

    console.log(`\nSaved. ${toAssign} animals assigned to line "${targetLine.name}".`);

    await mongoose.disconnect();
}

run().catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
});
