/**
 * Diagnostic: find transferred animals that are missing originalOwnerId.
 *
 * A "transferred" animal is one where soldStatus === 'sold' AND
 * viewOnlyForUsers has at least one entry (the previous owner was added there on transfer).
 * If originalOwnerId is null on such an animal, the litter-owner bypass is the only
 * protection — this script identifies those animals so they can be backfilled if needed.
 *
 * Usage: node scripts/check-missing-originalownerid.js
 * Optional: node scripts/check-missing-originalownerid.js --fix
 *   --fix backfills originalOwnerId from viewOnlyForUsers[0] where safe to do so.
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { Animal, User } = require('../database/models');

const FIX_MODE = process.argv.includes('--fix');

async function main() {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB.\n');

    // Animals that look transferred (soldStatus=sold) but have no originalOwnerId
    const candidates = await Animal.find({
        soldStatus: 'sold',
        originalOwnerId: null,
    }).select('id_public name ownerId ownerId_public viewOnlyForUsers soldStatus').lean();

    if (candidates.length === 0) {
        console.log('✅  No transferred animals with missing originalOwnerId found.');
        await mongoose.disconnect();
        return;
    }

    console.log(`⚠️  Found ${candidates.length} transferred animal(s) missing originalOwnerId:\n`);

    for (const animal of candidates) {
        const viewOnlyCount = animal.viewOnlyForUsers?.length ?? 0;
        const inferredOriginalOwner = animal.viewOnlyForUsers?.[0] ?? null;

        let inferredPublicId = null;
        if (inferredOriginalOwner) {
            const user = await User.findById(inferredOriginalOwner).select('id_public personalName breederName').lean();
            inferredPublicId = user ? (user.id_public || user.personalName || user.breederName || String(inferredOriginalOwner)) : String(inferredOriginalOwner);
        }

        console.log(`  Animal: ${animal.id_public} — "${animal.name}"`);
        console.log(`    Current owner public ID : ${animal.ownerId_public}`);
        console.log(`    viewOnlyForUsers count  : ${viewOnlyCount}`);
        console.log(`    Inferred original owner : ${inferredPublicId ?? '(none — cannot backfill)'}`);

        if (FIX_MODE && inferredOriginalOwner) {
            await Animal.updateOne(
                { _id: animal._id },
                { $set: { originalOwnerId: inferredOriginalOwner } }
            );
            console.log(`    ✅  Backfilled originalOwnerId → ${inferredPublicId}`);
        }
        console.log();
    }

    if (!FIX_MODE) {
        console.log('---');
        console.log('Run with --fix to backfill originalOwnerId from viewOnlyForUsers[0] where possible.');
        console.log('Review the output above before using --fix to make sure inferred owners look correct.');
    } else {
        console.log('Backfill complete.');
    }

    await mongoose.disconnect();
}

main().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
