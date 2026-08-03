/**
 * backfill-treatment-status.js
 *
 * One-time script that recomputes isInTreatment for EVERY animal, now that it's derived
 * from active medical records (active medications / active critical medicalConditions —
 * see utils/healthStatusSync.js) instead of being a manually-set flag driven by
 * treatmentDetails' status/startDate/endDate.
 *
 * treatmentDetails/treatmentHistory are unaffected — they remain descriptive metadata
 * (type/reason/dates) for the timeline. Only the isInTreatment boolean itself is recomputed.
 *
 * Safe to re-run at any time — fully idempotent (always recomputes from medications/
 * medicalConditions, never accumulates or guesses).
 *
 * Usage:
 *   node migrations/backfill-treatment-status.js                  (dry run, all animals)
 *   node migrations/backfill-treatment-status.js --apply          (writes changes, all animals)
 *   node migrations/backfill-treatment-status.js --user=CTU2       (dry run, one breeder only)
 *   node migrations/backfill-treatment-status.js --user=CTU2 --apply
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const mongoose = require('mongoose');
const { Animal, User } = require('../database/models');
const { computeIsInTreatment } = require('../utils/healthStatusSync');

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/crittertrack';
const APPLY = process.argv.includes('--apply');
const userArg = process.argv.find((arg) => arg.startsWith('--user='));
const USER_PUBLIC_ID = userArg ? userArg.split('=')[1] : null;

async function backfillTreatmentStatus() {
    let connection;
    try {
        connection = await mongoose.connect(MONGO_URI);
        console.log('Successfully connected to MongoDB.');
        console.log(APPLY ? 'Running in APPLY mode — changes will be written.' : 'Running in DRY-RUN mode — no changes will be written. Pass --apply to write.');

        let filter = {};
        if (USER_PUBLIC_ID) {
            const user = await User.findOne({ id_public: USER_PUBLIC_ID }).select('_id').lean();
            if (!user) {
                console.log(`No user found with id_public "${USER_PUBLIC_ID}". Nothing to do.`);
                return;
            }
            filter = { creatorId: user._id };
            console.log(`Scoping backfill to user "${USER_PUBLIC_ID}" only.`);
        }

        const animals = await Animal.find(filter)
            .select('id_public creatorId isInTreatment medications medicalConditions')
            .lean();

        console.log(`Checking ${animals.length} animal(s).`);

        let totalChanged = 0;
        for (const animal of animals) {
            const newIsInTreatment = computeIsInTreatment({ medications: animal.medications, medicalConditions: animal.medicalConditions });
            const changed = !!animal.isInTreatment !== newIsInTreatment;

            if (changed) {
                totalChanged++;
                console.log(`  * ${animal.id_public}: isInTreatment: ${!!animal.isInTreatment} -> ${newIsInTreatment}`);
                if (APPLY) {
                    await Animal.updateOne(
                        { _id: animal._id },
                        { $set: { isInTreatment: newIsInTreatment } }
                    );
                }
            }
        }

        console.log('----------------------------------------');
        console.log('Backfill finished.');
        console.log(`- Animals checked: ${animals.length}`);
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

backfillTreatmentStatus();
