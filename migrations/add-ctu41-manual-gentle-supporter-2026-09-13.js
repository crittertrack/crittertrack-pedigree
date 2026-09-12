// One-off: CTU41 pays €5/month (Gentle Supporter) via PayPal outside the new Ko-fi webhook
// system, so she needs a manually-tracked KofiPledge (source: 'manual') to get her diamond
// badge, count toward the iOS fundraiser total, and show up in the public Supporters credits.
require('dotenv').config();
const mongoose = require('mongoose');
const { User, PublicProfile, KofiPledge } = require('../database/models');

const ID_PUBLIC = 'CTU41';
const AMOUNT = 5;
const TIER_NAME = 'Gentle Supporter';
// Most recent 28th-of-the-month payment before today.
const LAST_PAYMENT_DATE = new Date('2026-08-28');

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

    await User.updateOne({ _id: user._id }, { monthlyDonationActive: true });
    await PublicProfile.updateOne({ id_public: ID_PUBLIC }, { monthlyDonationActive: true });

    const pledge = await KofiPledge.findOneAndUpdate(
        { idPublic: ID_PUBLIC, source: 'manual' },
        {
            kofiEmail: `manual:${ID_PUBLIC}`,
            idPublic: ID_PUBLIC,
            source: 'manual',
            creditName,
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
