/**
 * One-time migration: clear active marketplace listing state (isForSale,
 * salePriceAmount, studFeeAmount) on any animal already marked Deceased /
 * Culled / Rehomed (or with a deceasedDate set), so deceased animals stop
 * appearing in the marketplace. Sale records / buyer info are preserved.
 *
 * Runs against both the Animal and PublicAnimal collections. Idempotent — safe
 * to re-run (will report 0 cleared once everything is clean).
 *
 * Usage:
 *   cd crittertrack-pedigree
 *   node scripts/clear-sale-state-for-deceased.js
 */

require('dotenv').config();
const mongoose = require('mongoose');

const { connectDB } = require('../database/db_service');
const { Animal, PublicAnimal } = require('../database/models');

const DEATH_OR_REHOMED = {
    $or: [
        { deceasedDate: { $ne: null } },
        { status: { $in: ['Deceased', 'Culled', 'Rehomed'] } },
    ],
};

// Only ACTIVE marketplace listing state is cleared. Sale/reservation records
// (soldStatus, saleDate, salePrice, buyer info, saleTransactionId, currencies)
// are intentionally preserved for record-keeping.
const SALE_STATE_DEFAULTS = {
    isForSale: false,
    salePriceAmount: null,
    studFeeAmount: null,
};

const PUBLIC_SALE_STATE_DEFAULTS = {
    isForSale: false,
    salePriceAmount: null,
    studFeeAmount: null,
};

async function run() {
    if (!process.env.MONGODB_URI) {
        throw new Error('MONGODB_URI is not defined in environment variables.');
    }

    await connectDB(process.env.MONGODB_URI);
    console.log('[Migration] Connected to MongoDB.');

    const animalResult = await Animal.updateMany(
        DEATH_OR_REHOMED,
        { $set: SALE_STATE_DEFAULTS },
    );
    const publicResult = await PublicAnimal.updateMany(
        DEATH_OR_REHOMED,
        { $set: PUBLIC_SALE_STATE_DEFAULTS },
    );

    console.log(
        `[Migration] clear-sale-state-for-deceased: ` +
        `animals=${animalResult.modifiedCount}, public=${publicResult.modifiedCount}`,
    );

    await mongoose.disconnect();
    console.log('[Migration] Disconnected. Done.');
}

run().catch((err) => {
    console.error('[Migration] error:', err);
    process.exit(1);
});
