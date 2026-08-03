/**
 * backfill-quarantine-status.js
 *
 * One-time script that recomputes isQuarantine / isInTreatment for EVERY animal that has
 * quarantineDetails or treatmentDetails set, using the corrected date-comparison logic.
 *
 * Bug fixed: isStatusPeriodActive() (crittertrack-frontend/src/components/AnimalForm/
 * AnimalFormModalV2.jsx) used to compare the stored UTC-midnight startDate/endDate against a
 * *local*-midnight "today" Date object. For any user in a timezone ahead of UTC, a period whose
 * startDate is literally today got treated as "not yet started" (start > today), so isQuarantine
 * was saved as false even though the user had just set status to "Quarantine" starting today.
 *
 * This script recomputes both flags from quarantineDetails/treatmentDetails using calendar-date
 * (UTC) string comparison, matching the corrected frontend logic, and fixes any animal whose
 * saved isQuarantine/isInTreatment no longer matches what its own details say it should be.
 *
 * Safe to re-run at any time — fully idempotent (always recomputes from quarantineDetails/
 * treatmentDetails, never accumulates or guesses).
 *
 * Usage:
 *   node migrations/backfill-quarantine-status.js                  (dry run, all animals)
 *   node migrations/backfill-quarantine-status.js --apply          (writes changes, all animals)
 *   node migrations/backfill-quarantine-status.js --user=CTU2       (dry run, one breeder only)
 *   node migrations/backfill-quarantine-status.js --user=CTU2 --apply
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const mongoose = require('mongoose');
const { Animal, User } = require('../database/models');

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/crittertrack';
const APPLY = process.argv.includes('--apply');
const userArg = process.argv.find((arg) => arg.startsWith('--user='));
const USER_PUBLIC_ID = userArg ? userArg.split('=')[1] : null;

const toUTCDateString = (value) => new Date(value).toISOString().slice(0, 10);

// Mirrors the corrected isStatusPeriodActive() in AnimalFormModalV2.jsx.
function isStatusPeriodActive(details) {
    if (!details || !details.status || details.status === 'None') return false;
    if (!details.startDate) return false;
    const todayStr = toUTCDateString(new Date());
    const startStr = toUTCDateString(details.startDate);
    if (startStr > todayStr) return false;
    if (details.endDate) {
        const endStr = toUTCDateString(details.endDate);
        if (endStr < todayStr) return false;
    }
    return true;
}

async function backfillQuarantineStatus() {
    let connection;
    try {
        connection = await mongoose.connect(MONGO_URI);
        console.log('Successfully connected to MongoDB.');
        console.log(APPLY ? 'Running in APPLY mode — changes will be written.' : 'Running in DRY-RUN mode — no changes will be written. Pass --apply to write.');

        let filter = {
            $or: [
                { 'quarantineDetails.status': { $exists: true, $ne: 'None' } },
                { 'treatmentDetails.status': { $exists: true, $ne: 'None' } },
            ],
        };
        if (USER_PUBLIC_ID) {
            const user = await User.findOne({ id_public: USER_PUBLIC_ID }).select('_id').lean();
            if (!user) {
                console.log(`No user found with id_public "${USER_PUBLIC_ID}". Nothing to do.`);
                return;
            }
            filter = { creatorId: user._id, ...filter };
            console.log(`Scoping backfill to user "${USER_PUBLIC_ID}" only.`);
        }

        const animals = await Animal.find(filter)
            .select('id_public creatorId isQuarantine isInTreatment quarantineDetails treatmentDetails')
            .lean();

        console.log(`Found ${animals.length} animal(s) with an active-or-past quarantine/treatment record set.`);

        let totalChanged = 0;
        for (const animal of animals) {
            const newIsQuarantine = isStatusPeriodActive(animal.quarantineDetails);
            const newIsInTreatment = isStatusPeriodActive(animal.treatmentDetails);
            const changed = !!animal.isQuarantine !== newIsQuarantine || !!animal.isInTreatment !== newIsInTreatment;

            if (changed) {
                totalChanged++;
                console.log(`  * ${animal.id_public}: isQuarantine: ${!!animal.isQuarantine} -> ${newIsQuarantine}, isInTreatment: ${!!animal.isInTreatment} -> ${newIsInTreatment}`);
                if (APPLY) {
                    await Animal.updateOne(
                        { _id: animal._id },
                        { $set: { isQuarantine: newIsQuarantine, isInTreatment: newIsInTreatment } }
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

backfillQuarantineStatus();
