// One-off: Loki is a genuine active Ko-fi subscriber (no CritterTrack account) whose webhook
// payment never made it into KofiPledge (the webhook integration recorded nothing at all before
// this), so she's backfilled manually here to count toward the fundraiser total + credits.
require('dotenv').config();
const mongoose = require('mongoose');
const { KofiPledge } = require('../database/models');

const CREDIT_NAME = 'Loki';
const KOFI_EMAIL = 'paypal@lokisowilo.eu';
const AMOUNT = 5;
const TIER_NAME = 'Gentle Supporter';
const LAST_PAYMENT_DATE = new Date('2026-09-02'); // 11 days before this script's write date

(async () => {
    await mongoose.connect(process.env.MONGODB_URI);

    const pledge = await KofiPledge.findOneAndUpdate(
        { kofiEmail: KOFI_EMAIL },
        {
            kofiEmail: KOFI_EMAIL,
            idPublic: null,
            source: 'kofi',
            creditName: CREDIT_NAME,
            isPublic: true,
            tierName: TIER_NAME,
            amount: AMOUNT,
            currency: 'EUR',
            isSubscription: true,
            lastPaymentDate: LAST_PAYMENT_DATE,
        },
        { upsert: true, new: true }
    );

    console.log('Pledge saved:', pledge);
    await mongoose.disconnect();
})();
