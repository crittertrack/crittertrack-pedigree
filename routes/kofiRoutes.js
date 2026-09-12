const express = require('express');
const router = express.Router();
const { User, PublicProfile, KofiPledge } = require('../database/models');

// A Ko-fi subscription payment counts as "still active" for this many days after its last
// payment — a bit over a month, since Ko-fi doesn't send a webhook event when someone cancels,
// only on successful payments. See kofiBadgeExpiryCronJob in index.js for how this is enforced.
const SUBSCRIPTION_GRACE_DAYS = 35;

async function setMonthlyBadge(idPublic, active) {
    const user = await User.findOneAndUpdate({ id_public: idPublic }, { monthlyDonationActive: active }, { new: true });
    if (user) await PublicProfile.updateOne({ id_public: idPublic }, { monthlyDonationActive: active });
    return user;
}

// Tries to identify which CritterTrack account (if any) a Ko-fi payment belongs to:
// first by a "CTU123"-style ID left in the supporter's message, then by matching emails.
async function findMatchingUser(event) {
    const idMatch = (event.message || '').match(/\bCTU\d+\b/i);
    if (idMatch) {
        const user = await User.findOne({ id_public: idMatch[0].toUpperCase() });
        if (user) return user;
    }
    if (event.email) {
        const escaped = event.email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const user = await User.findOne({ email: new RegExp(`^${escaped}$`, 'i') });
        if (user) return user;
    }
    return null;
}

// POST /api/kofi/webhook — Ko-fi calls this on every successful payment (one-time or subscription).
// Ko-fi POSTs a single urlencoded field named "data" containing a JSON string (parsed by the
// global bodyParser.urlencoded() in index.js), not a raw JSON body — there's no HMAC signature,
// just a verification_token embedded in the payload to compare against your own secret.
// Register this URL in Ko-fi's Settings > API page:
//   https://crittertrack-pedigree-production.up.railway.app/api/kofi/webhook
router.post('/webhook', async (req, res) => {
    try {
        const raw = req.body?.data;
        if (!raw) return res.sendStatus(400);
        const event = JSON.parse(raw);

        if (!process.env.KOFI_VERIFICATION_TOKEN || event.verification_token !== process.env.KOFI_VERIFICATION_TOKEN) {
            console.warn('[Ko-fi] Webhook rejected: verification token mismatch');
            return res.sendStatus(401);
        }

        const amount = parseFloat(event.amount) || 0;
        console.log(`[Ko-fi] ${event.type} | ${amount} ${event.currency} | tier=${event.tier_name || 'n/a'} | sub=${!!event.is_subscription_payment} | email=${event.email}`);

        const user = await findMatchingUser(event);

        const trimmedName = (event.from_name || '').trim();
        const creditName = trimmedName || null;

        // Track it toward the iOS fundraiser's live monthly total and supporter credits,
        // keyed by the Ko-fi email so repeat/renewal payments update the same record.
        await KofiPledge.findOneAndUpdate(
            { kofiEmail: event.email },
            {
                kofiEmail: event.email,
                idPublic: user?.id_public || null,
                creditName,
                isPublic: event.is_public !== false,
                tierName: event.tier_name || null,
                amount,
                currency: event.currency || 'EUR',
                isSubscription: !!event.is_subscription_payment,
                lastPaymentDate: new Date(),
                kofiTransactionId: event.kofi_transaction_id || null,
            },
            { upsert: true }
        );

        // Grant/refresh the account's donation badge, if we could identify who paid
        if (user) {
            if (event.is_subscription_payment) {
                await setMonthlyBadge(user.id_public, true);
            } else {
                await User.findByIdAndUpdate(user._id, { lastDonationDate: new Date() });
                await PublicProfile.updateOne({ id_public: user.id_public }, { lastDonationDate: new Date() });
            }
        } else {
            console.warn(`[Ko-fi] Could not match payment from ${event.email} to a CritterTrack account`);
        }

        res.sendStatus(200);
    } catch (err) {
        console.error('[Ko-fi] Webhook error:', err.message);
        res.sendStatus(200); // acknowledge anyway so Ko-fi doesn't endlessly retry a bad payload
    }
});

// GET /api/kofi/ios-fundraiser — public; the frontend progress bar reads the live total from
// here instead of a hand-maintained constant.
router.get('/ios-fundraiser', async (req, res) => {
    try {
        const cutoff = new Date(Date.now() - SUBSCRIPTION_GRACE_DAYS * 24 * 60 * 60 * 1000);
        // Manual pledges (e.g. a pre-existing PayPal subscriber, added by an admin) count
        // regardless of lastPaymentDate recency — there's no automatic renewal signal for them.
        const activePledges = await KofiPledge.find({
            isSubscription: true,
            $or: [{ lastPaymentDate: { $gte: cutoff } }, { source: 'manual' }],
        }).select('amount');
        const total = activePledges.reduce((sum, p) => sum + (p.amount || 0), 0);
        res.json({ total: Math.round(total * 100) / 100, supporterCount: activePledges.length });
    } catch (err) {
        console.error('[Ko-fi] ios-fundraiser fetch error:', err.message);
        res.status(500).json({ error: 'Failed to load fundraiser total' });
    }
});

// GET /api/kofi/supporters — public list for the supporter credits feature. Only includes
// pledges with a name and where the supporter didn't opt out of Ko-fi's public visibility.
router.get('/supporters', async (req, res) => {
    try {
        const supporters = await KofiPledge.find({ isPublic: true, creditName: { $ne: null } })
            .select('creditName tierName isSubscription lastPaymentDate')
            .sort({ lastPaymentDate: -1 })
            .lean();
        res.json(supporters.map(s => ({
            name: s.creditName,
            tierName: s.tierName,
            isSubscription: s.isSubscription,
        })));
    } catch (err) {
        console.error('[Ko-fi] supporters fetch error:', err.message);
        res.status(500).json({ error: 'Failed to load supporters' });
    }
});

module.exports = router;
