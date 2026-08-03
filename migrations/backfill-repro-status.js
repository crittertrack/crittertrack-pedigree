/**
 * backfill-repro-status.js
 *
 * One-time script that recomputes isPlannedMating / isInMating / isPregnant /
 * isNursing for EVERY animal referenced as a sire or dam in any Litter record,
 * using the same authoritative logic now enforced automatically on every
 * litter create/update/delete (see utils/reproStatusSync.js).
 *
 * This fixes existing production animals whose flags drifted out of sync
 * with their litter records before that automatic sync existed (e.g. an
 * animal stuck showing "Pregnant" after its litter's birthDate was recorded
 * through a code path that didn't update the animal document).
 *
 * Safe to re-run at any time — it is fully idempotent (always recomputes
 * from the current Litter data, never accumulates or guesses).
 *
 * Usage:
 *   node migrations/backfill-repro-status.js            (dry run — logs only)
 *   node migrations/backfill-repro-status.js --apply    (writes changes)
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const mongoose = require('mongoose');
const { Litter } = require('../database/models');
const { syncParentReproStatus } = require('../utils/reproStatusSync');

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/crittertrack';
const APPLY = process.argv.includes('--apply');

async function backfillReproStatus() {
    let connection;
    try {
        connection = await mongoose.connect(MONGO_URI);
        console.log('Successfully connected to MongoDB.');
        console.log(APPLY ? 'Running in APPLY mode — changes will be written.' : 'Running in DRY-RUN mode — no changes will be written. Pass --apply to write.');

        // Group every distinct (creatorId, id_public) parent pair referenced by any litter.
        const litters = await Litter.find({})
            .select('creatorId sireId_public damId_public')
            .lean();

        const parentsByCreator = new Map(); // creatorId (string) -> Set of id_public
        for (const litter of litters) {
            if (!litter.creatorId) continue;
            const key = litter.creatorId.toString();
            if (!parentsByCreator.has(key)) parentsByCreator.set(key, new Set());
            const set = parentsByCreator.get(key);
            if (litter.sireId_public) set.add(litter.sireId_public);
            if (litter.damId_public) set.add(litter.damId_public);
        }

        console.log(`Found ${litters.length} litters spanning ${parentsByCreator.size} breeder(s).`);

        let totalAnimals = 0;
        for (const [creatorId, idSet] of parentsByCreator.entries()) {
            const idList = [...idSet];
            totalAnimals += idList.length;
            console.log(`- Breeder ${creatorId}: recomputing status for ${idList.length} animal(s)...`);
            if (APPLY) {
                await syncParentReproStatus(creatorId, idList);
            }
        }

        console.log('----------------------------------------');
        console.log('Backfill finished.');
        console.log(`- Breeders processed: ${parentsByCreator.size}`);
        console.log(`- Animal reproductive-status records recomputed: ${totalAnimals}`);
        if (!APPLY) console.log('This was a DRY RUN — no data was changed. Re-run with --apply to write changes.');
        console.log('----------------------------------------');
    } catch (error) {
        console.error('An error occurred during the backfill:', error);
        process.exit(1);
    } finally {
        if (connection) {
            await mongoose.disconnect();
            console.log('Disconnected from MongoDB.');
        }
    }
}

backfillReproStatus();
