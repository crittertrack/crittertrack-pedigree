/**
 * Migration: backfill-isPlanned
 * Sets isPlanned = true for litters that have no birthDate and no litterSizeBorn (> 0).
 * These are records created via the "+ Mating" form before the isPlanned field was deployed.
 * 
 * Run once: node migrations/backfill-isPlanned.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { Litter } = require('../database/models');

async function run() {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    const result = await Litter.updateMany(
        {
            birthDate: { $exists: false },
            isPlanned: { $ne: true },
            numberBorn: { $in: [0, null, undefined] },
            litterSizeBorn: { $in: [0, null, undefined] },
        },
        { $set: { isPlanned: true } }
    );

    console.log(`Updated ${result.modifiedCount} litter(s) → isPlanned: true`);
    await mongoose.disconnect();
}

run().catch(err => { console.error(err); process.exit(1); });
