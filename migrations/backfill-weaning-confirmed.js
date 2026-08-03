/**
 * backfill-weaning-confirmed.js
 *
 * One-time script that sets weaningConfirmed = true on every existing Litter
 * document that already has a weaningDate set.
 *
 * Background: weaningConfirmed is a new field, only ever set true by the
 * explicit "Wean Today" action going forward (see utils/reproStatusSync.js,
 * which now requires weaningConfirmed — not just a weaningDate value — before
 * treating a litter's nursing cycle as closed). Without this backfill, every
 * pre-existing litter that already recorded a weaningDate under the old
 * date-comparison logic would default to weaningConfirmed = false and
 * incorrectly flip its dam back to "nursing" (or fully unassign her, if past
 * the nursing cutoff) the next time flags are recomputed.
 *
 * This script preserves the prior implicit meaning: a weaningDate already on
 * record that had already arrived (weaningDate <= today, matching the exact
 * closure rule enforced immediately before this change) represents an actual/
 * confirmed weaning event. Litters with a future-dated weaningDate were NOT
 * previously considered weaned/closed either, so they are intentionally left
 * unconfirmed — exactly matching their pre-migration computed state.
 *
 * Safe to re-run — it only ever touches litters where weaningDate has already
 * arrived and weaningConfirmed is not already true.
 *
 * Usage:
 *   node migrations/backfill-weaning-confirmed.js             (dry run, all breeders)
 *   node migrations/backfill-weaning-confirmed.js --apply     (writes changes)
 *   node migrations/backfill-weaning-confirmed.js --user=CTU2 (dry run, one breeder only)
 *   node migrations/backfill-weaning-confirmed.js --user=CTU2 --apply
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const mongoose = require('mongoose');
const { Litter, User } = require('../database/models');

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/crittertrack';
const APPLY = process.argv.includes('--apply');
const userArg = process.argv.find((arg) => arg.startsWith('--user='));
const USER_PUBLIC_ID = userArg ? userArg.split('=')[1] : null;

async function backfillWeaningConfirmed() {
    let connection;
    try {
        connection = await mongoose.connect(MONGO_URI);
        console.log('Successfully connected to MongoDB.');
        console.log(APPLY ? 'Running in APPLY mode — changes will be written.' : 'Running in DRY-RUN mode — no changes will be written. Pass --apply to write.');

        const filter = {
            weaningDate: { $ne: null, $lte: new Date() },
            $or: [{ weaningConfirmed: { $exists: false } }, { weaningConfirmed: false }],
        };

        if (USER_PUBLIC_ID) {
            const user = await User.findOne({ id_public: USER_PUBLIC_ID }).select('_id').lean();
            if (!user) {
                console.log(`No user found with id_public "${USER_PUBLIC_ID}". Nothing to do.`);
                return;
            }
            filter.creatorId = user._id;
            console.log(`Scoping backfill to user "${USER_PUBLIC_ID}" only.`);
        }

        const litters = await Litter.find(filter)
            .select('litter_id_public weaningDate weaningConfirmed')
            .lean();

        console.log(`Found ${litters.length} litter(s) with a weaningDate but no weaningConfirmed flag.`);
        litters.forEach((l) => {
            console.log(`  - ${l.litter_id_public || l._id}: weaningDate=${new Date(l.weaningDate).toISOString().slice(0, 10)}`);
        });

        if (APPLY && litters.length > 0) {
            const result = await Litter.updateMany(
                { _id: { $in: litters.map((l) => l._id) } },
                { $set: { weaningConfirmed: true } }
            );
            console.log(`Updated ${result.modifiedCount} litter(s).`);
        } else if (litters.length > 0) {
            console.log('Dry run — no changes written. Pass --apply to write.');
        }
    } catch (error) {
        console.error('Error during weaningConfirmed backfill:', error);
    } finally {
        if (connection) {
            await mongoose.disconnect();
            console.log('Disconnected from MongoDB.');
        }
    }
}

backfillWeaningConfirmed();
