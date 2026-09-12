// One-off: CTU9 made a solo €40 Ko-fi donation 12 days ago that never made it into KofiPledge
// (same missing-webhook issue as Loki's pledge), so it's backfilled here — one-time gift, not a
// subscription, so it also refreshes lastDonationDate for her 31-day flame badge.
require('dotenv').config();
const mongoose = require('mongoose');
const { User, PublicProfile, KofiPledge } = require('../database/models');

const ID_PUBLIC = 'CTU9';
const AMOUNT = 40;
const DONATION_DATE = new Date('2026-09-01'); // 12 days before this script's write date

(async () => {
    await mongoose.connect(process.env.MONGODB_URI);

    const user = await User.findOne({ id_public: ID_PUBLIC });
    if (!user) {
        console.log(`${ID_PUBLIC} not found`);
        await mongoose.disconnect();
        return;
    }

    const creditName = (user.showBreederName && user.breederName) ? user.breederName
        : (user.showPersonalName && user.personalName) ? user.personalName
        : ID_PUBLIC;
    console.log('Crediting as:', creditName);

    await User.updateOne({ _id: user._id }, { lastDonationDate: DONATION_DATE });
    await PublicProfile.updateOne({ id_public: ID_PUBLIC }, { lastDonationDate: DONATION_DATE });

    const pledge = await KofiPledge.findOneAndUpdate(
        { idPublic: ID_PUBLIC, source: 'kofi', isSubscription: false },
        {
            kofiEmail: `unknown:${ID_PUBLIC}`,
            idPublic: ID_PUBLIC,
            source: 'kofi',
            creditName,
            isPublic: true,
            tierName: null,
            amount: AMOUNT,
            currency: 'EUR',
            isSubscription: false,
            lastPaymentDate: DONATION_DATE,
        },
        { upsert: true, new: true }
    );

    console.log('Pledge saved:', pledge);
    await mongoose.disconnect();
})();
