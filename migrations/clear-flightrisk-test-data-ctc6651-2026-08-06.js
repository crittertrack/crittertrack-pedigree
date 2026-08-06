// One-off cleanup: clears the stray flightRiskTrainingSchedule test data on CTC6651
// (Alabama, Fancy Mouse) found by audit-hidden-fields-with-data-2026-08-06.js.
// Run with: node migrations/clear-flightrisk-test-data-ctc6651-2026-08-06.js
require('dotenv').config();
const mongoose = require('mongoose');
const { Animal } = require('../database/models');

async function main() {
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error('MONGODB_URI not found in environment variables.');
    await mongoose.connect(uri);
    console.log('Connected to MongoDB.');

    const before = await Animal.findOne({ id_public: 'CTC6651' }).select('id_public name species flightRiskTrainingSchedule').lean();
    if (!before) throw new Error('CTC6651 not found.');
    console.log('Before:', JSON.stringify(before.flightRiskTrainingSchedule));

    const result = await Animal.updateOne(
        { id_public: 'CTC6651' },
        { $set: { flightRiskTrainingSchedule: { lastDoneDate: null, frequencyDays: null, lastSkipped: false } } }
    );
    console.log('Matched:', result.matchedCount, 'Modified:', result.modifiedCount);

    const after = await Animal.findOne({ id_public: 'CTC6651' }).select('flightRiskTrainingSchedule').lean();
    console.log('After:', JSON.stringify(after.flightRiskTrainingSchedule));

    await mongoose.disconnect();
}

main().catch(err => { console.error(err); process.exit(1); });
