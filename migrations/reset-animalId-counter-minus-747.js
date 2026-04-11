/**
 * One-time fix: Subtract 747 from the animalId counter to reclaim IDs
 * consumed by the failed Kintraks import stubs that were deleted.
 *
 * Usage (dry run):  node migrations/reset-animalId-counter-minus-747.js
 * Usage (execute):  CONFIRM=true node migrations/reset-animalId-counter-minus-747.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const { Counter } = require('../database/models');

async function run() {
    const uri = process.env.MONGODB_URI;
    if (!uri) { console.error('MONGODB_URI not set'); process.exit(1); }

    await mongoose.connect(uri);
    console.log('Connected to MongoDB\n');

    const doc = await Counter.findById('animalId');
    if (!doc) { console.error('animalId counter not found'); process.exit(1); }

    const before = doc.seq;
    const after  = before - 747;
    console.log(`Current animalId seq: ${before}  (CTC${before})`);
    console.log(`After reset:          ${after}   (CTC${after})`);

    if (process.env.CONFIRM !== 'true') {
        console.log('\nDRY RUN — no changes made.');
        console.log('Re-run with CONFIRM=true to execute.');
        await mongoose.disconnect();
        return;
    }

    await Counter.findByIdAndUpdate('animalId', { $set: { seq: after } });
    console.log('\nCounter updated. Done!');
    await mongoose.disconnect();
}

run().catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
});
