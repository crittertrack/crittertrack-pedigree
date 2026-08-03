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
 *   node migrations/backfill-repro-status.js                  (dry run, all breeders)
 *   node migrations/backfill-repro-status.js --apply          (writes changes, all breeders)
 *   node migrations/backfill-repro-status.js --user=CTU2       (dry run, one breeder only)
 *   node migrations/backfill-repro-status.js --user=CTU2 --apply
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const mongoose = require('mongoose');
const { Litter, User, Animal } = require('../database/models');
const { syncParentReproStatus, computeReproFlags, buildNursingCutoffMap } = require('../utils/reproStatusSync');

const FLAG_KEYS = ['isPlannedMating', 'isInMating', 'isPregnant', 'isNursing'];

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/crittertrack';
const APPLY = process.argv.includes('--apply');
const userArg = process.argv.find((arg) => arg.startsWith('--user='));
const USER_PUBLIC_ID = userArg ? userArg.split('=')[1] : null;

async function backfillReproStatus() {
    let connection;
    try {
        connection = await mongoose.connect(MONGO_URI);
        console.log('Successfully connected to MongoDB.');
        console.log(APPLY ? 'Running in APPLY mode — changes will be written.' : 'Running in DRY-RUN mode — no changes will be written. Pass --apply to write.');

        let litterFilter = {};
        if (USER_PUBLIC_ID) {
            const user = await User.findOne({ id_public: USER_PUBLIC_ID }).select('_id').lean();
            if (!user) {
                console.log(`No user found with id_public "${USER_PUBLIC_ID}". Nothing to do.`);
                return;
            }
            litterFilter = { creatorId: user._id };
            console.log(`Scoping backfill to user "${USER_PUBLIC_ID}" only.`);
        }

        // Group every distinct (creatorId, id_public) parent pair referenced by any litter.
        const litters = await Litter.find(litterFilter)
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
        let totalChanged = 0;
        for (const [creatorId, idSet] of parentsByCreator.entries()) {
            const idList = [...idSet];
            totalAnimals += idList.length;
            console.log(`- Breeder ${creatorId}: checking ${idList.length} animal(s)...`);

            for (const id_public of idList) {
                const parentLitters = await Litter.find({
                    creatorId,
                    $or: [{ sireId_public: id_public }, { damId_public: id_public }],
                }).select('sireId_public damId_public isPlanned matingDate pregnancyDate birthDate weaningDate pregnancyLost createdAt').lean();

                const nursingCutoffByLitter = await buildNursingCutoffMap(parentLitters);
                const newFlags = computeReproFlags(parentLitters, id_public, nursingCutoffByLitter);
                const current = await Animal.findOne({ creatorId, id_public }).select(FLAG_KEYS.join(' ')).lean();
                if (!current) continue; // animal referenced by a litter but no longer exists

                const changedKeys = FLAG_KEYS.filter((key) => !!current[key] !== !!newFlags[key]);
                if (changedKeys.length) {
                    totalChanged++;
                    const diff = changedKeys.map((key) => `${key}: ${!!current[key]} -> ${newFlags[key]}`).join(', ');
                    console.log(`  * ${id_public}: ${diff}`);
                }
            }

            if (APPLY) {
                await syncParentReproStatus(creatorId, idList);
            }
        }

        console.log('----------------------------------------');
        console.log('Backfill finished.');
        console.log(`- Breeders processed: ${parentsByCreator.size}`);
        console.log(`- Animals checked: ${totalAnimals}`);
        console.log(`- Animals with changed flags: ${totalChanged}`);
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
