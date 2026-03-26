/**
 * Migration: reset-ctu2-gender-counts-to-linked
 *
 * For every CTU2 litter that has linked offspring, resets maleCount /
 * femaleCount / unknownCount to ONLY the counts derived from the linked
 * animals.  This clears the inflated values caused by the old Math.max
 * reconciliation bug, giving the breeder a clean baseline so they can
 * manually top up each litter to the true totals.
 *
 * litterSizeBorn / numberBorn are LEFT UNCHANGED.
 *
 * Run with:
 *   node migrations/reset-ctu2-gender-counts-to-linked.js             (live)
 *   node migrations/reset-ctu2-gender-counts-to-linked.js --dry-run   (preview)
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');

const DRY_RUN    = process.argv.includes('--dry-run');
const BREEDER_ID = 'CTU2';

function log(msg) { process.stdout.write(msg + '\n'); }

async function main() {
    const uri = process.env.MONGODB_URI || process.env.DB_URI;
    if (!uri) { log('ERROR: MONGODB_URI not set. Aborting.'); process.exit(1); }

    await mongoose.connect(uri);
    log(`Connected to MongoDB${DRY_RUN ? ' [DRY RUN — no writes]' : ''}`);

    const { Litter, Animal, PublicAnimal } = require('../database/models');

    // Find the owner
    const { User } = require('../database/models');
    const breeder = await User.findOne({ id_public: BREEDER_ID }).lean();
    if (!breeder) { log(`ERROR: User ${BREEDER_ID} not found.`); process.exit(1); }
    log(`Found user: ${breeder.personalName || breeder.breederName} (_id: ${breeder._id})\n`);

    // All litters for this breeder
    const litters = await Litter.find({ ownerId: breeder._id }).lean();
    log(`Total litters: ${litters.length}`);

    // Collect all offspringIds_public across all litters in one batch query
    const allOffspringIds = [...new Set(litters.flatMap(l => l.offspringIds_public || []))];
    log(`Unique linked animal IDs across all litters: ${allOffspringIds.length}`);

    // Fetch gender for all linked animals in two queries (owned + public collections)
    const ownedAnimals = Animal
        ? await Animal.find({ id_public: { $in: allOffspringIds } }, { id_public: 1, gender: 1 }).lean()
        : [];
    const publicAnimals = PublicAnimal
        ? await PublicAnimal.find({ id_public: { $in: allOffspringIds } }, { id_public: 1, gender: 1 }).lean()
        : [];

    // Build a map: id_public -> gender (prefer owned record)
    const genderMap = new Map();
    for (const a of publicAnimals) genderMap.set(a.id_public, a.gender || 'Unknown');
    for (const a of ownedAnimals)  genderMap.set(a.id_public, a.gender || 'Unknown');
    log(`Gender map built for ${genderMap.size} animals\n`);

    let updated = 0;
    let skipped = 0;

    for (const litter of litters) {
        const ids = litter.offspringIds_public || [];
        if (ids.length === 0) continue;   // handled in the zero-out pass below

        let males = 0, females = 0, unknown = 0;
        for (const id of ids) {
            const gender = genderMap.get(id) || 'Unknown';
            if (gender === 'Male')         males++;
            else if (gender === 'Female')  females++;
            else                           unknown++;
        }

        const label = litter.litter_id_public || String(litter._id);
        log(`  ${label} — linked: ${ids.length}  →  ${males}M / ${females}F / ${unknown}U  born: ${ids.length}`
            + `  (was: ${litter.maleCount ?? '-'}M / ${litter.femaleCount ?? '-'}F / ${litter.unknownCount ?? '-'}U  born: ${litter.litterSizeBorn ?? litter.numberBorn ?? '-'})`);

        if (!DRY_RUN) {
            await Litter.updateOne({ _id: litter._id }, {
                $set: {
                    maleCount:       males       || null,
                    femaleCount:     females     || null,
                    unknownCount:    unknown     || null,
                    litterSizeBorn:  ids.length  || null,
                    numberBorn:      ids.length  || null,
                }
            });
            log(`    ✅ Updated`);
        } else {
            log(`    ℹ️  Would update`);
        }
        updated++;
    }

    // Also zero out litters with no linked offspring that still have stale counts
    let zeroed = 0;
    for (const litter of litters) {
        if ((litter.offspringIds_public || []).length > 0) continue; // already handled above
        const hasStale = litter.maleCount || litter.femaleCount || litter.unknownCount
            || litter.litterSizeBorn || litter.numberBorn;
        if (!hasStale) { skipped++; continue; }

        const label = litter.litter_id_public || String(litter._id);
        log(`  ${label} — no linked animals, clearing stale counts`
            + `  (was: ${litter.maleCount ?? '-'}M / ${litter.femaleCount ?? '-'}F / ${litter.unknownCount ?? '-'}U  born: ${litter.litterSizeBorn ?? litter.numberBorn ?? '-'})`);

        if (!DRY_RUN) {
            await Litter.updateOne({ _id: litter._id }, {
                $set: { maleCount: null, femaleCount: null, unknownCount: null, litterSizeBorn: null, numberBorn: null }
            });
            log(`    ✅ Zeroed`);
        } else {
            log(`    ℹ️  Would zero`);
        }
        zeroed++;
    }

    log(`\n--- Summary ---`);
    log(`Litters with linked offspring reset     : ${updated}`);
    log(`Litters without linked offspring zeroed : ${zeroed}`);
    log(`Litters already clean (skipped)         : ${skipped}`);
    log(DRY_RUN ? '\nDRY RUN complete — no changes written.' : '\nDone.');
    await mongoose.disconnect();
}

main().catch(err => { console.error(err); process.exit(1); });
